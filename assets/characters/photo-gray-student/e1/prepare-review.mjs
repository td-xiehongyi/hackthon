import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../../tools/map/png.mjs';

const dir = new URL('./', import.meta.url);
const bytes = readFileSync(new URL('character-views.png', dir));
const p = decodePng(bytes);
if (p.width !== 1536 || p.height !== 1024 || p.channels !== 4) throw new Error('Unexpected sheet dimensions/format');
const hist = Array(256).fill(0);
for (let i = 3; i < p.data.length; i += 4) hist[p.data[i]]++;
const facings = ['down', 'left', 'right', 'up'];
// Side-view scooters extend beyond equal-width grid cells; keep them intact.
const rects = [
  [0,0,384,512,190,496], [384,0,384,512,182,496],
  [768,0,384,512,204,496], [1152,0,384,512,190,496],
  [0,512,340,512,190,482], [340,512,428,512,207,482],
  [768,512,428,512,222,482], [1196,512,340,512,147,482],
];
const frames = rects.map(([x,y,width,height,ax,ay],i) => ({
  mode:i<4?'walk':'ride', facing:facings[i%4],
  rect:{x,y,width,height}, anchor:{x:ax,y:ay},
}));
const inspection = frames.map(f => {
  const {x,y,width,height} = f.rect;
  let minX=width,minY=height,maxX=-1,maxY=-1,count=0;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
    if(p.data[((y+yy)*p.width+x+xx)*4+3]>=200){
      count++; minX=Math.min(minX,xx); minY=Math.min(minY,yy);
      maxX=Math.max(maxX,xx); maxY=Math.max(maxY,yy);
    }
  }
  return {mode:f.mode,facing:f.facing,subjectPixels:count,
    localBoundsAtAlpha200:{minX,minY,maxX,maxY},
    touchesCropEdge:minX===0||minY===0||maxX===width-1||maxY===height-1};
});
if(inspection.some(f=>!f.subjectPixels||f.touchesCropEdge)) throw new Error('Subject missing or touches crop edge');
const metadata = {stage:'E1',status:'appearance-approved',approvedOn:'2026-09-26',characterId:'photo-gray-student',
  image:'character-views.png',width:p.width,height:p.height,
  anchorStatus:'visual-estimates-for-preview-only',candidateWalkWorldHeight:30,frames};
const report = {width:p.width,height:p.height,channels:p.channels,
  sha256:createHash('sha256').update(bytes).digest('hex'),
  transparentPixels:hist[0],opaquePixels:hist[255],
  semiTransparentPixels:hist.slice(1,255).reduce((a,b)=>a+b,0),
  alphaHistogram:hist,frames:inspection};
writeFileSync(new URL('review-metadata.json',dir),JSON.stringify(metadata,null,2)+'\n');
writeFileSync(new URL('inspection.json',dir),JSON.stringify(report,null,2)+'\n');
let html=readFileSync(new URL('../../photo-student/e1/preview.html',dir),'utf8');
html=html.replace('中南大学像素校园｜照片角色样张','中南大学像素校园｜灰衣黑包男生样张')
 .replace('当前为 E1 外观审阅稿。','E1 外观已确认；最新动画小样见本角色 E2 目录。')
 .replace('把照片里的她，带进像素校园','灰衣、黑包，走进像素校园')
 .replace('深棕长发与刘海 · 粉白开衫 · 蓝色耳饰 · 浅蓝长裙。','黑色短发 · 灰色短袖 · 浅蓝长裤 · 黑色双肩包 · 领口眼镜。')
 .replace('鞋子、背面及电动车为设计补全','完整裤型、白色运动鞋、背面及蓝色电动车为设计补全；基础姿态双手放松或扶车把')
 .replace('缩小后耳饰、五官细节会丢失','缩小后领口眼镜、五官细节会丢失')
 .replace('源图仍有轻微半透明边缘，正式素材应继续清理。','源图有真实透明背景，但主体仍含半透明像素，正式素材需继续清理。')
 .replace(/const frames=\[[\s\S]*?\];/,'const frames='+JSON.stringify(frames)+';')
 .replace('Number(size.value)/448','Number(size.value)/458');
writeFileSync(new URL('preview.html',dir),html);
console.log(JSON.stringify({...report,alphaHistogram:undefined},null,2));
