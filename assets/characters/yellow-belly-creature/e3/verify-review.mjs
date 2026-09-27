import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('.',import.meta.url));
const url=process.argv[2]??'http://127.0.0.1:5214/assets/characters/yellow-belly-creature/e3/preview.html';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1200},deviceScaleFactor:1});
const errors=[],checks=[];
const check=(name,ok,details)=>{checks.push({name,passed:Boolean(ok),details});if(!ok)throw Error(name)};
const state=()=>page.evaluate(()=>window.__e2.getSnapshot());
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(url);await page.waitForFunction(()=>window.previewReady===true);
  check('eight-direction-animation-cards',await page.locator('.card').count()===8);
  check('manifest-contract',await page.evaluate(()=>window.__e2.problems.length===0));
  await page.locator('#game').click();
  const before=await state();
  await page.keyboard.down('Shift');await page.waitForFunction(()=>window.__e2.getSnapshot().mode==='ride');
  const ride=await state();check('shift-preserves-ground-point',JSON.stringify(before.position)===JSON.stringify(ride.position),{before,ride});
  await page.keyboard.up('Shift');await page.waitForFunction(()=>window.__e2.getSnapshot().mode==='walk');
  check('release-shift-restores-walk',(await state()).mode==='walk');
  await page.keyboard.down('d');await page.waitForTimeout(350);const moving=await state();
  check('wasd-moves-on-map',moving.position.x>before.position.x&&moving.moving&&moving.facing==='right',{before:before.position,after:moving.position});
  await page.keyboard.up('d');await page.waitForTimeout(80);
  const stopped=await state();check('stop-keeps-facing',!stopped.moving&&stopped.facing==='right');
  await page.keyboard.down('Shift');await page.keyboard.down('d');await page.waitForTimeout(180);
  check('ride-animation-selected',(await state()).mode==='ride');
  await page.locator('#game').screenshot({path:output+'map-ride-preview.png'});
  await page.keyboard.up('d');await page.keyboard.up('Shift');
  await page.locator('#reset').click();
  await page.keyboard.down('d');await page.keyboard.down('Shift');await page.waitForTimeout(60);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(80);
  const blurred=await state();await page.waitForTimeout(160);const later=await state();
  check('blur-clears-movement-and-shift',!blurred.moving&&blurred.mode==='walk'&&JSON.stringify(blurred.position)===JSON.stringify(later.position));
  await page.keyboard.up('d');await page.keyboard.up('Shift');
  await page.locator('#reset').click();
  const pathSamples=[];await page.keyboard.down('w');
  for(let i=0;i<10;i++){await page.waitForTimeout(80);pathSamples.push(await state())}
  await page.keyboard.up('w');
  check('sampled-movement-stays-in-walkable-area',pathSamples.every(s=>s.canStand));
  await page.locator('#reset').click();
  const frames=await page.evaluate(()=>{
    const {scene,manifest}=window.__e2;scene.scene.pause();const results=[];
    for(const clip of manifest.clips){
      const s={position:{...scene.start},mode:clip.mode,facing:clip.facing,moving:clip.action==='move'};
      scene.character.update(s,0);
      for(let i=0;i<clip.frames.length;i++){
        if(i>0)scene.character.update(s,clip.frames[i-1].durationMs);
        const f=clip.frames[i],expected=`${f.rect.x},${f.rect.y},${f.rect.width},${f.rect.height}`;
        results.push({clip:`${clip.mode}/${clip.facing}/${clip.action}`,index:i,expected,actual:scene.character.currentFrameName,groundStable:scene.character.image.x===Math.round(scene.start.x)&&scene.character.image.y===Math.round(scene.start.y)});
      }
    }
    scene.state={position:{...scene.start},mode:'walk',facing:'down',moving:false};scene.character.update(scene.state,0);scene.scene.resume();return results;
  });
  check('all-40-frame-references-render-correctly',frames.length===40&&frames.every(f=>f.expected===f.actual),frames);
  check('all-frame-ground-points-stable',frames.every(f=>f.groundStable));
  await page.screenshot({path:output+'review-preview.png',fullPage:true});
  check('no-browser-script-errors',errors.length===0,errors);
  const annotation=await page.evaluate(()=>({occluders:window.__e2.scene.annotation.occluders.length,status:window.__e2.scene.annotation.annotationStatus}));
  const report={browser:await browser.version(),url,checks,annotation,limitations:['Map occlusion layers absent; real building/tree occlusion not verified.','Weak-alpha/color fringes, side-view belly patch consistency, gait continuity and wheel motion remain art-review items.','Preview uses scale 0.11; application default scale is unchanged.']};
  writeFileSync(output+'verification.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,total:checks.length,browser:report.browser,annotation}));
}finally{await browser.close()}

