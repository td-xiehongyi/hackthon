import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir=new URL('./',import.meta.url);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:1050},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('preview.html',dir).href);
  await page.waitForFunction(()=>window.previewReady===true);
  const cards=await page.locator('#views .card').count();
  const loaded=await page.locator('#status').textContent();
  const originalPoint=await page.evaluate(()=>window.characterReview.getPoint());
  const results=[];
  for(const mode of ['walk','ride'])for(const facing of ['down','left','right','up']) {
    await page.selectOption('#mode',mode);
    await page.selectOption('#facing',facing);
    const point=await page.evaluate(()=>window.characterReview.getPoint());
    results.push({mode,facing,point,stable:JSON.stringify(point)===JSON.stringify(originalPoint)});
  }
  await page.selectOption('#mode','walk');
  await page.selectOption('#facing','down');
  await page.screenshot({path:fileURLToPath(new URL('review-preview.png',dir)),fullPage:true});
  await page.selectOption('#mode','ride');
  await page.selectOption('#facing','right');
  await page.locator('#map').screenshot({path:fileURLToPath(new URL('map-ride-preview.png',dir))});
  const report={browser:'Microsoft Edge headless',cards,loaded,pageErrors:errors,previewAnchorChecks:results,scope:'E1 standalone preview only; not game integration, animation, collision or occlusion verification'};
  writeFileSync(new URL('browser-check.json',dir),JSON.stringify(report,null,2)+'\n');
  if(cards!==8||errors.length||results.some(r=>!r.stable))throw new Error('Preview verification failed');
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
