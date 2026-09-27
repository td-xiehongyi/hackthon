const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 const page = await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(__dirname,'中南大学像素校园-交互布局预览.html')).href);
 const results=[];
 for(const [width,height] of [[1440,900],[1366,768],[1920,1080],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});
  await page.locator('#place-title').waitFor();
  const geometry=await page.evaluate(()=>{
   const rail=document.querySelector('.persistent-sidebar').getBoundingClientRect();
   const panel=document.querySelector('#panel').getBoundingClientRect();
   return {sidebarWidth:rail.width,panelLeft:panel.left,panelTop:panel.top,panelHeight:panel.height,panelWidth:panel.width,mapVisibleRight:innerWidth-panel.right,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  if(geometry.panelLeft<geometry.sidebarWidth || geometry.mapVisibleRight<20 || geometry.overflow) throw new Error(JSON.stringify(geometry));
  for(const selector of ['.preview-bar','.game-header','.bottom-hud','.map-status-note']){
   if(await page.locator(selector).isVisible())throw new Error('Unwanted element visible: '+selector);
  }
  await page.screenshot({path:path.join(__dirname,`preview-${width}.png`)});
  results.push({width,height,...geometry});
 }
 await page.setViewportSize({width:1440,height:900});
 for(const place of ['library','stadium','teaching']){
  await page.locator('#return-campus').click();
  await page.locator(`.campus-choices [data-place="${place}"]`).click();
  await page.screenshot({path:path.join(__dirname,`preview-${place}.png`)});
 }
 await page.locator('#return-campus').click();
 if(!await page.locator('.persistent-sidebar').isVisible()) throw new Error('Sidebar missing after closing panel');
 if(errors.length)throw new Error(errors.join('\n'));
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({results,errors,sceneSwitches:3},null,2));
 console.log(JSON.stringify({results,errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
