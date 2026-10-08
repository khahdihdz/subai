import {spawn} from 'node:child_process';
export function run(cmd,args,{signal}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe']}); let out='',err='';
    const abort=()=>{try{p.kill('SIGTERM')}catch{}};
    if(signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
    p.stdout.on('data',d=>{out+=d.toString();if(out.length>8000)out=out.slice(-8000)});
    p.stderr.on('data',d=>{err+=d.toString();if(err.length>12000)err=err.slice(-12000)});
    p.on('error',reject);
    p.on('close',c=>{signal?.removeEventListener('abort',abort);if(signal?.aborted)return reject(new Error('JOB_CANCELLED'));c===0?resolve({out,err}):reject(new Error(`FFmpeg exit ${c}: ${err.slice(-4000)}`))});
  });
}
export async function ffprobe(f){
  return JSON.parse((await run('ffprobe',['-v','error','-show_entries','format=duration,format_name,size','-of','json',f])).out).format;
}
export const extractAudio=(i,o,opts={})=>run('ffmpeg',['-y','-i',i,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',o],opts);
export function subtitleFilter(s,size=22,color='&H00FFFFFF',outline=2,margin=24){
  const esc=s.replaceAll('\\','\\\\').replaceAll(':','\\:').replaceAll("'","\\'");
  return `subtitles='${esc}':force_style='FontName=DejaVu Sans,FontSize=${size},PrimaryColour=${color},OutlineColour=&H00000000,Outline=${outline},Shadow=1,MarginV=${margin}'`;
}
export const burn=(i,s,o,opts={},runOpts={})=>run('ffmpeg',['-y','-i',i,'-vf',subtitleFilter(s,opts.fontSize||22,opts.color||'&H00FFFFFF',opts.outline||2,opts.marginV||24),'-c:v','libx264','-preset','veryfast','-crf',String(opts.crf||23),'-c:a','copy',o],runOpts);
export const mixAudio=(video,voice,out,replace=false,opts={})=>run('ffmpeg',['-y','-i',video,'-i',voice,'-map','0:v:0','-map',replace?'1:a:0':'0:a:0?','-c:v','copy' ,'-c:a','aac',out],opts);
