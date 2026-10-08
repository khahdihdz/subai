import fs from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import path from 'node:path';
import {config,dirs} from '../../config/config.js';
import {getJob,updateJob,recoverJobs} from '../../database/db.js';
import {extractAudio,ffprobe,burn,mixAudio,run} from '../video/ffmpeg.js';
import {parseSrt,toSrt,toVtt} from '../subtitle/srt.js';
import {translateBatch} from '../ai/openrouter.js';
import {synthesize} from '../tts/api.js';

export const events=new Map();
export const controllers=new Map();
const emit=(id,d)=>{const a=events.get(id)||[];a.push({...d,time:Date.now()});events.set(id,a);if(a.length>200)a.shift()};
let running=0,q=[];
export const enqueue=t=>{q.push(t);pump()};
async function pump(){if(running>=config.concurrency||!q.length)return;running++;const task=q.shift();try{await task()}finally{running--;pump()}}
export const init=()=>recoverJobs();
function assertActive(id){if(getJob(id)?.status==='cancelled')throw new Error('JOB_CANCELLED')}
function toClock(sec){const ms=Math.round(Number(sec||0)*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`}
async function stt(audio){
  if(!config.sttUrl||!config.sttModel)throw new Error('Chưa cấu hình STT_API_URL/STT_MODEL');
  const body=new FormData();
  body.append('file',await openAsBlob(audio),path.basename(audio));
  body.append('model',config.sttModel);
  const r=await fetch(config.sttUrl,{method:'POST',headers:config.sttKey?{Authorization:`Bearer ${config.sttKey}`}:undefined,body});
  if(!r.ok)throw new Error(`STT HTTP ${r.status}: ${(await r.text()).slice(0,500)}`);
  const z=await r.json();
  return (z.segments||[]).map((x,i)=>({index:i+1,start:toClock(x.start),end:toClock(x.end),text:x.text||''}));
}
async function ttsSegments(id,subs,signal){
  const files=[];
  for(let i=0;i<subs.length;i++){
    assertActive(id);
    const f=path.join(dirs.voice,id+`_${String(i+1).padStart(5,'0')}.mp3`);
    await synthesize(subs[i].text,f);
    files.push({file:f,start:subs[i].start,end:subs[i].end});
    emit(id,{progress:65+Math.round((i+1)/subs.length*15),status:`Đang tạo giọng đọc ${i+1}/${subs.length}`});
  }
  return files;
}
async function buildVoiceTrack(id,parts){
  if(!parts.length)throw new Error('Không có đoạn thoại để TTS');
  const inputs=[],filters=[],labels=[];
  for(let i=0;i<parts.length;i++){
    inputs.push('-i',parts[i].file);
    const start=parts[i].start.replace(',', '.');
    const [h,m,s]=start.split(':').map(Number); const delay=Math.max(0,Math.round((h*3600+m*60+s)*1000));
    const label=`a${i}`; labels.push(`[${label}]`);
    filters.push(`[${i}:a]adelay=${delay}|${delay}[${label}]`);
  }
  const out=path.join(dirs.voice,id+'_vi.mp3');
  filters.push(`${labels.join('')}amix=inputs=${parts.length}:duration=longest:dropout_transition=0[aout]`);
  await run('ffmpeg',['-y',...inputs,'-filter_complex',filters.join(';'),'-map','[aout]','-c:a','libmp3lame','-q:a','4',out]);
  return out;
}
export function processJob(id,input,opt={}){
  const controller=new AbortController();controllers.set(id,controller);
  enqueue(async()=>{
    try{
      updateJob(id,{status:'processing',progress:2,error:null});emit(id,{progress:2,status:'Đang kiểm tra video'});assertActive(id);
      const meta=await ffprobe(input);const duration=Number(meta.duration||0);
      if(!duration)throw new Error('Không đọc được thời lượng video');
      if(duration>config.maxDuration)throw new Error('Video vượt quá thời lượng cho phép');
      if(!/(mp4|matroska|mov|webm|avi|mpeg|mpegts)/i.test(String(meta.format_name||'')))throw new Error('Định dạng video không được hỗ trợ');
      const audio=path.join(dirs.audio,id+'.wav');await extractAudio(input,audio,{signal:controller.signal});assertActive(id);
      updateJob(id,{progress:18});emit(id,{progress:18,status:'Đang nhận dạng giọng nói'});
      const source=path.join(dirs.subtitles,id+'_source.srt');
      let subs=await fs.access(source).then(()=>parseSrt(await fs.readFile(source,'utf8'))).catch(()=>stt(audio));
      if(!subs.length)throw new Error('Không có subtitle để xử lý');
      updateJob(id,{progress:30});emit(id,{progress:30,status:`Đang dịch ${subs.length} đoạn`});
      for(let i=0;i<subs.length;i+=20){assertActive(id);const b=await translateBatch(subs.slice(i,i+20));subs.splice(i,b.length,...b);const p=30+Math.round(Math.min(i+b.length,subs.length)/subs.length*35);updateJob(id,{progress:p});emit(id,{progress:p,status:`Đang dịch ${Math.min(i+b.length,subs.length)}/${subs.length}`})}
      const srt=path.join(dirs.subtitles,id+'_vi.srt'),vtt=path.join(dirs.subtitles,id+'_vi.vtt');
      await fs.writeFile(srt,toSrt(subs));await fs.writeFile(vtt,toVtt(subs));const outs=[srt,vtt];let video=input;
      if(opt.tts){const parts=await ttsSegments(id,subs,controller.signal);const voice=await buildVoiceTrack(id,parts);outs.push(voice);const dubbed=path.join(dirs.output,id+'_dubbed.mp4');await mixAudio(video,voice,dubbed,true,{signal:controller.signal});video=dubbed;outs.push(dubbed)}
      if(opt.burn){updateJob(id,{progress:85});emit(id,{progress:85,status:'Đang burn subtitle'});const out=path.join(dirs.output,id+'_subbed.mp4');await burn(video,srt,out,opt,{signal:controller.signal});if(video!==input)await fs.rm(video,{force:true});video=out;outs.push(out)}
      assertActive(id);updateJob(id,{status:'completed',progress:100,output_files:JSON.stringify(outs)});emit(id,{progress:100,status:'Hoàn thành',files:outs});
    }catch(e){if(e.message==='JOB_CANCELLED'||getJob(id)?.status==='cancelled'){updateJob(id,{status:'cancelled',error:'Job đã bị hủy'});emit(id,{status:'Đã hủy',error:'Job đã bị hủy'})}else{updateJob(id,{status:'failed',error:e.message});emit(id,{status:'Lỗi',error:e.message})}}
    finally{controllers.delete(id)}
  });
}
export function cancelJob(id){const c=controllers.get(id);updateJob(id,{status:'cancelled'});if(c)c.abort();emit(id,{status:'Đã hủy',error:'Job đã bị hủy'});return true}
