import fs from 'node:fs/promises';
import path from 'node:path';
import FormData from 'form-data';
import {config,dirs} from '../../config/config.js';
import {getJob,updateJob,recoverJobs} from '../../database/db.js';
import {extractAudio,ffprobe,burn,mixAudio,run} from '../video/ffmpeg.js';
import {parseSrt,toSrt} from '../subtitle/srt.js';
import {translateBatch} from '../ai/openrouter.js';
import {synthesize} from '../tts/api.js';

export const events=new Map(), controllers=new Map();
const emit=(id,d)=>{const a=events.get(id)||[];a.push({...d,time:Date.now()});events.set(id,a);if(a.length>200)a.shift()};
let running=0,q=[];
export const enqueue=t=>{q.push(t);pump()};
async function pump(){if(running>=config.concurrency||!q.length)return;running++;const task=q.shift();try{await task()}finally{running--;pump()}}
export const init=()=>recoverJobs();
function cancelled(id){return getJob(id)?.status==='cancelled'}
function assertActive(id){if(cancelled(id))throw new Error('JOB_CANCELLED')}
async function stt(audio){
  if(!config.sttUrl)throw new Error('Chưa cấu hình STT_API_URL');
  const fd=new FormData(); fd.append('file',requireStream(audio),'audio.wav'); fd.append('model',config.sttModel);
  const r=await fetch(config.sttUrl,{method:'POST',headers:fd.getHeaders(),body:fd});
  if(!r.ok)throw new Error(`STT HTTP ${r.status}: ${(await r.text()).slice(0,500)}`);
  const z=await r.json();
  return (z.segments||[]).map((x,i)=>({index:i+1,start:toClock(x.start),end:toClock(x.end),text:x.text||''}));
}
function requireStream(p){return import('node:fs').then(m=>m.createReadStream(p))}
function toClock(sec){const ms=Math.round(Number(sec||0)*1000);const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`}
async function ttsSegments(id,subs){
  const files=[]; for(let i=0;i<subs.length;i++){const f=path.join(dirs.voice,id+`_${String(i+1).padStart(5,'0')}.mp3`);await synthesize(subs[i].text,f);files.push({file:f,start:subs[i].start,end:subs[i].end});emit(id,{progress:65+Math.round((i+1)/subs.length*15),status:`Đang tạo giọng đọc ${i+1}/${subs.length}`})}
  return files;
}
async function buildVoiceTrack(id,parts){
  const list=path.join(dirs.temp,id+'_tts.txt');
  const lines=parts.map(x=>`file '${path.resolve(x.file).replaceAll("'","'\\''")}'`).join('\n')+'\n';
  await fs.writeFile(list,lines);
  const out=path.join(dirs.voice,id+'_vi.mp3');
  await run('ffmpeg',['-y','-f','concat','-safe','0','-i',list,'-c:a','libmp3lame','-q:a','4',out]);
  return out;
}
export function processJob(id,input,opt={}){
  const controller=new AbortController(); controllers.set(id,controller);
  enqueue(async()=>{
    try{
      updateJob(id,{status:'processing',progress:2,error:null});emit(id,{progress:2,status:'Đang kiểm tra video'});
      assertActive(id); const meta=await ffprobe(input); const duration=Number(meta.duration||0);
      if(!duration)throw new Error('Không đọc được thời lượng video');
      if(duration>config.maxDuration)throw new Error('Video vượt quá thời lượng cho phép');
      if(!String(meta.format_name||'').match(/(mp4|matroska|mov|webm|avi|mpeg|mpegts)/i))throw new Error('Định dạng video không được hỗ trợ');
      const audio=path.join(dirs.audio,id+'.wav'); await extractAudio(input,audio,{signal:controller.signal});
      assertActive(id);updateJob(id,{progress:18});emit(id,{progress:18,status:'Đang nhận dạng giọng nói'});
      let subs=opt.subtitle?parseSrt(await fs.readFile(opt.subtitle,'utf8')):await stt(audio);
      if(!subs.length)throw new Error('STT không tạo được subtitle');
      updateJob(id,{progress:30});emit(id,{progress:30,status:`Đang dịch ${subs.length} đoạn`});
      for(let i=0;i<subs.length;i+=20){assertActive(id);const b=await translateBatch(subs.slice(i,i+20));subs.splice(i,b.length,...b);const p=30+Math.round(Math.min(i+b.length,subs.length)/subs.length*35);updateJob(id,{progress:p});emit(id,{progress:p,status:`Đang dịch ${Math.min(i+b.length,subs.length)}/${subs.length}`})}
      const srt=path.join(dirs.subtitles,id+'_vi.srt');await fs.writeFile(srt,toSrt(subs));const outs=[srt];
      let video=input;
      if(opt.tts){const parts=await ttsSegments(id,subs);const voice=await buildVoiceTrack(id,parts);outs.push(voice);const dubbed=path.join(dirs.output,id+'_dubbed.mp4');await mixAudio(video,voice,dubbed,true,{signal:controller.signal});video=dubbed;outs.push(dubbed)}
      if(opt.burn){updateJob(id,{progress:85});emit(id,{progress:85,status:'Đang burn subtitle'});const out=path.join(dirs.output,id+'_subbed.mp4');await burn(video,srt,out,opt,{signal:controller.signal});if(video!==input)await fs.rm(video,{force:true});video=out;outs.push(out)}
      assertActive(id);updateJob(id,{status:'completed',progress:100,output_files:JSON.stringify(outs)});emit(id,{progress:100,status:'Hoàn thành',files:outs});
    }catch(e){if(e.message==='JOB_CANCELLED'||cancelled(id)){updateJob(id,{status:'cancelled',error:'Job đã bị hủy'});emit(id,{status:'Đã hủy',error:'Job đã bị hủy'})}else{updateJob(id,{status:'failed',error:e.message});emit(id,{status:'Lỗi',error:e.message})}}
    finally{controllers.delete(id)}
  });
}
export function cancelJob(id){const c=controllers.get(id);updateJob(id,{status:'cancelled'});if(c)c.abort();emit(id,{status:'Đã hủy',error:'Job đã bị hủy'});return true}
