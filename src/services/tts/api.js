import fs from 'node:fs/promises';
export async function synthesize(text,out){
  const {config}=await import('../../config/config.js');
  if(!config.ttsUrl||!config.ttsModel)throw new Error('Chưa cấu hình TTS_API_URL/TTS_MODEL');
  const r=await fetch(config.ttsUrl,{method:'POST',headers:{Authorization:`Bearer ${config.ttsKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.ttsModel,input:text,voice:config.ttsVoice,response_format:'mp3'})});
  if(!r.ok)throw new Error(`TTS HTTP ${r.status}: ${(await r.text()).slice(0,500)}`);
  await fs.writeFile(out,Buffer.from(await r.arrayBuffer()));
  return out;
}
