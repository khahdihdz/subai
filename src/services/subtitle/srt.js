const clean = s => String(s ?? '').replace(/^\uFEFF/,'').trim();
export function parseTime(v){
  const m=clean(v).replace('.',',').match(/^(?:(\d+):)?(\d{2}):(\d{2}),(\d{3})$/);
  if(!m) throw new Error('Timestamp subtitle không hợp lệ: '+v);
  return Number(m[1]||0)*3600000+Number(m[2])*60000+Number(m[3])*1000+Number(m[4]);
}
export function formatTime(ms,sep=','){
  ms=Math.max(0,Math.round(Number(ms)||0));
  const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+sep+String(x).padStart(3,'0');
}
export function parseSrt(s){
  const blocks=clean(s).split(/\r?\n\s*\r?\n+/);
  return blocks.map((b,n)=>{
    const l=b.split(/\r?\n/);
    const ti=l.findIndex(x=>x.includes('-->')); if(ti<0)return null;
    const [start,end]=l[ti].split('-->').map(x=>x.trim().split(/\s+/)[0]);
    parseTime(start); parseTime(end);
    return {index:Number(l[ti-1])||n+1,start,end,text:l.slice(ti+1).join('\n').trim()};
  }).filter(Boolean);
}
export function parseVtt(s){
  const body=clean(s).replace(/^WEBVTT[^\n]*\n/i,'').replace(/^NOTE[\s\S]*?\n\n/gm,'');
  return parseSrt(body.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g,'$1,$2').replace(/^(\d{2}:\d{2})\.(\d{3})/gm,'00:$1,$2'));
}
export function toSrt(a){return a.map((x,i)=>`${i+1}\n${x.start} --> ${x.end}\n${x.text||''}\n`).join('\n');}
export function toVtt(a){return 'WEBVTT\n\n'+a.map((x,i)=>`${i+1}\n${x.start.replace(',', '.')} --> ${x.end.replace(',', '.')}\n${x.text||''}\n`).join('\n');}
export function detectFormat(name=''){return /\.vtt$/i.test(name)?'vtt':/\.(ass|ssa)$/i.test(name)?'ass':'srt';}
