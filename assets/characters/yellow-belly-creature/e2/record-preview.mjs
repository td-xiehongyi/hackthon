import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const dir=fileURLToPath(new URL('./',import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1200,height:950}});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:5214/assets/characters/yellow-belly-creature/e2/preview.html');
 await page.waitForFunction(()=>window.previewReady===true);
 const data=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=940;
  const ctx=canvas.getContext('2d');const stream=canvas.captureStream(24);
  const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mimeType)throw Error('No supported WebM recorder');
  const chunks=[],recorder=new MediaRecorder(stream,{mimeType});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const stopped=new Promise(resolve=>recorder.onstop=resolve);
  const start=performance.now();let active=true;
  const render=()=>{
   if(!active)return;
   ctx.fillStyle='#f4f3ee';ctx.fillRect(0,0,960,940);
   ctx.fillStyle='#203a33';ctx.font='bold 24px sans-serif';ctx.fillText('黄肚肚 · E2 动画小样',24,36);
   ctx.font='16px sans-serif';ctx.fillText('上排步行 / 下排骑行 · 朝下、朝左、朝右、朝上',24,65);
   window.__e2.sampleEntries.forEach((entry,i)=>{
    const x=i%4*240,y=80+Math.floor(i/4)*215;
    ctx.fillStyle='#e9eee6';ctx.fillRect(x+5,y,230,208);
    ctx.drawImage(entry.canvas,x+5,y,230,208);
   });
   ctx.fillStyle='#203a33';ctx.fillText('地图操作预览 · 外观和动作待审阅',24,543);
   ctx.drawImage(document.querySelector('#game canvas'),0,560,960,380);
   const elapsed=performance.now()-start;
   const send=(type,key)=>window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));
   if(elapsed>2600&&!window.__demoWalk){send('keydown','d');window.__demoWalk=true}
   if(elapsed>3100&&!window.__demoStop){send('keyup','d');window.__demoStop=true}
   if(elapsed>3900&&!window.__demoRide){send('keydown','Shift');send('keydown','a');window.__demoRide=true}
   if(elapsed>4400&&!window.__demoEnd){send('keyup','a');send('keyup','Shift');window.__demoEnd=true}
   requestAnimationFrame(render);
  };
  recorder.start();render();await new Promise(resolve=>setTimeout(resolve,6500));active=false;recorder.stop();await stopped;
  stream.getTracks().forEach(t=>t.stop());
  const blob=new Blob(chunks,{type:'video/webm'});
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
 });
 writeFileSync(dir+'animation-preview.webm',Buffer.from(data));
 await context.close();
 console.log(JSON.stringify({saved:'animation-preview.webm',bytes:data.length,method:'Browser MediaRecorder of live preview canvases',durationSeconds:6.5}));
}finally{await browser.close()}
