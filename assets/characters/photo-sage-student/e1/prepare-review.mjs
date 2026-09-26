import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../../tools/map/png.mjs';

const dir = new URL('./', import.meta.url);
const bytes = readFileSync(new URL('character-views-v2.png', dir));
const p = decodePng(bytes);
if (p.width !== 1536 || p.height !== 1024 || p.channels !== 4) throw new Error('Unexpected sheet dimensions/format');
const hist = Array(256).fill(0);
for (let i=3;i<p.data.length;i+=4) hist[p.data[i]]++;
const facings = ['down','left','right','up'];
const rects = [
  [0,0,384,512,190,503], [384,0,384,512,176,503],
  [768,0,384,512,192,503], [1152,0,384,512,190,503],
  [0,512,340,512,190,481], [340,512,428,512,211,481],
  [768,512,428,512,218,481], [1196,512,340,512,144,481],
];
const frames = rects.map(([x,y,width,height,ax,ay],i)=>({mode:i<4?'walk':'ride',facing:facings[i%4],rect:{x,y,width,height},anchor:{x:ax,y:ay}}));
const inspection = frames.map(f=>{
  const {x,y,width,height}=f.rect; let minX=width,minY=height,maxX=-1,maxY=-1,count=0;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
    if(p.data[((y+yy)*p.width+x+xx)*4+3] >= 200){count++;minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);}
  }
  return {mode:f.mode,facing:f.facing,subjectPixels:count,localBoundsAtAlpha200:{minX,minY,maxX,maxY},touchesCropEdge:minX===0||minY===0||maxX===width-1||maxY===height-1};
});
const metadata={stage:'E1',status:'appearance-review-pending',image:'character-views-v2.png',width:p.width,height:p.height,anchorStatus:'visual-estimates-for-preview-only',candidateWalkWorldHeight:30,frames};
const report={width:p.width,height:p.height,channels:p.channels,sha256:createHash('sha256').update(bytes).digest('hex'),transparentPixels:hist[0],opaquePixels:hist[255],semiTransparentPixels:hist.slice(1,255).reduce((a,b)=>a+b,0),alphaHistogram:hist,frames:inspection};
writeFileSync(new URL('review-metadata.json',dir),JSON.stringify(metadata,null,2)+'\n');
writeFileSync(new URL('inspection.json',dir),JSON.stringify(report,null,2)+'\n');

// Reuse the project's existing standalone E1 review layout; no application files changed.
let html=readFileSync(new URL('../../photo-student/e1/preview.html',dir),'utf8');
html=html.replace('中南大学像素校园｜照片角色样张','中南大学像素校园｜棕发绿包女生样张')
 .replace('把照片里的她，带进像素校园','棕发、绿包，走进像素校园')
 .replace('深棕长发与刘海 · 粉白开衫 · 蓝色耳饰 · 浅蓝长裙。','棕色齐肩卷发 · 黑色绿字上衣 · 浅灰长裤 · 鼠尾草绿斜挎包。')
 .replace('鞋子、背面及电动车为设计补全','完整裤型、鞋子、背面及电动车为设计补全；步行与骑行时相机收起')
 .replace('缩小后耳饰、五官细节会丢失','缩小后衣服字样、五官细节会丢失')
 .replace('源图仍有轻微半透明边缘，正式素材应继续清理。','源图主体与边缘仍含半透明像素，正式素材需继续清理。')
 .replaceAll('character-views.png','character-views-v2.png')
 .replace(/const frames=\[[\s\S]*?\];/, 'const frames='+JSON.stringify(frames)+';')
 .replace('Number(size.value)/448','Number(size.value)/478')
 .replace('sprite(cc,f,115,216,.43)','sprite(cc,f,115,216,.41)');
writeFileSync(new URL('preview.html',dir),html);
console.log(JSON.stringify({width:p.width,height:p.height,transparentPixels:report.transparentPixels,opaquePixels:report.opaquePixels,semiTransparentPixels:report.semiTransparentPixels,frames:inspection},null,2));
