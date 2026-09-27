import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=new URL('./',import.meta.url);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1150,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5207/assets/characters/photo-olive-student/e4/compare.html');
 await page.waitForFunction(()=>window.comparisonReady===true);
 await page.locator('#play').click();
 const start=await page.evaluate(()=>window.compareFrame),phases=[];
 for(let i=0;i<4;i++){
  await page.locator('#step').click();
  const frame=await page.evaluate(()=>window.compareFrame);
  if(frame!==(start+i+1)%4)throw Error('Incorrect single step');
  phases.push(frame);
 }
 await page.screenshot({path:fileURLToPath(new URL('comparison-preview.png',dir)),fullPage:true});
 await page.locator('#strip').screenshot({path:fileURLToPath(new URL('side-frames-review.png',dir))});
 if(errors.length)throw Error(errors.join(';'));
 const report={cards:await page.locator('article').count(),singleStepPhases:phases,errors,scope:'Comparison UI loading and four-step cycling; visual art assessed separately'};
 writeFileSync(new URL('comparison-check.json',dir),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await browser.close()}
