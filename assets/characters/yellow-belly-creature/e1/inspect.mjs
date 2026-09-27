import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng } from '../../../../tools/map/png.mjs';

const dir = new URL('./', import.meta.url);
const bytes = readFileSync(new URL('character-views-v3.png', dir));
const p = decodePng(bytes);
const hist = Array(256).fill(0);
for (let i=3;i<p.data.length;i+=4) hist[p.data[i]]++;
// Independent side-view crops keep both scooter wheels intact.
const rects = [[0,0,384,512],[384,0,384,512],[768,0,384,512],[1152,0,384,512],
  [0,512,340,512],[340,512,428,512],[768,512,428,512],[1196,512,340,512]];
const facings=['down','left','right','up'];
const frames=rects.map(([x,y,width,height],i)=>{
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
    if(p.data[((y+yy)*p.width+x+xx)*4+3]>=200){
      minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);
    }
  }
  return {mode:i<4?'walk':'ride',facing:facings[i%4],rect:{x,y,width,height},
    anchor:{x:Math.round((minX+maxX)/2),y:maxY+1},
    boundsAtAlpha200:{minX,minY,maxX,maxY},
    touchesEdge:minX===0||minY===0||maxX===width-1||maxY===height-1};
});
const report={width:p.width,height:p.height,channels:p.channels,sha256:createHash('sha256').update(bytes).digest('hex'),
  transparentPixels:hist[0],opaquePixels:hist[255],semiTransparentPixels:hist.slice(1,255).reduce((a,b)=>a+b,0),alphaHistogram:hist,frames};
writeFileSync(new URL('inspection.json',dir),JSON.stringify(report,null,2)+'\n');
writeFileSync(new URL('review-metadata.json',dir),JSON.stringify({stage:'E1',status:'awaiting-belly-revision-review',baseAppearanceApprovedOn:'2026-09-27',characterId:'yellow-belly-creature',
  image:'character-views-v3.png',width:p.width,height:p.height,anchorStatus:'candidate-visual-estimates-not-animation-validated',candidateWalkWorldHeight:30,
  frames:frames.map(({boundsAtAlpha200,touchesEdge,...frame})=>frame)},null,2)+'\n');
console.log(JSON.stringify({...report,alphaHistogram:undefined},null,2));
