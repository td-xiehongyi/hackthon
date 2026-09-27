import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../../tools/map/png.mjs';
const dir=new URL('./',import.meta.url);
const bytes=readFileSync(new URL('character-views.png',dir));
const p=decodePng(bytes);
if(p.channels!==4||p.width%4||p.height%2)throw new Error('Expected RGBA and 4x2 layout');
const hist=Array(256).fill(0);
for(let i=3;i<p.data.length;i+=4)hist[p.data[i]]++;
const w=p.width/4,h=p.height/2;
const facings=['down','left','right','up'];
const frames=[],checks=[];
for(let i=0;i<8;i++){
 // Side scooters extend beyond equal columns; crop whole vehicles independently.
 const regions=[[0,384],[384,384],[768,384],[1152,384],[0,340],[340,428],[768,428],[1196,340]];
 const [x,cw]=regions[i],y=Math.floor(i/4)*h;
 let minX=cw,minY=h,maxX=-1,maxY=-1;
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<cw;xx++)if(p.data[((y+yy)*p.width+x+xx)*4+3]>=200){minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);}
 if(maxX<0)throw new Error('Empty cell '+i);
 const f={mode:i<4?'walk':'ride',facing:facings[i%4],rect:{x,y,width:cw,height:h},anchor:{x:Math.round((minX+maxX)/2),y:maxY+1}};
 frames.push(f);checks.push({mode:f.mode,facing:f.facing,boundsAtAlpha200:{minX,minY,maxX,maxY},touchesCropEdge:minX===0||minY===0||maxX===cw-1||maxY===h-1});
}
const report={width:p.width,height:p.height,channels:p.channels,sha256:createHash('sha256').update(bytes).digest('hex'),transparentPixels:hist[0],opaquePixels:hist[255],semiTransparentPixels:hist.slice(1,255).reduce((a,b)=>a+b,0),frames:checks};
writeFileSync(new URL('inspection.json',dir),JSON.stringify(report,null,2)+'\n');
const metadata={stage:'E1',status:'appearance-approved',approvedOn:'2026-09-27',characterId:'photo-olive-student',image:'character-views.png',width:p.width,height:p.height,anchorStatus:'alpha-bounds estimates; visual review required',candidateWalkWorldHeight:30,frames};
writeFileSync(new URL('review-metadata.json',dir),JSON.stringify(metadata,null,2)+'\n');
let html=readFileSync(new URL('../../photo-student/e1/preview.html',dir),'utf8');
html=html.replace('中南大学像素校园｜照片角色样张','中南大学像素校园｜圆框眼镜男生样张')
 .replace('当前为 E1 外观审阅稿。','E1 外观已确认；最新动画见本角色 E2 目录。')
 .replace('把照片里的她，带进像素校园','圆框眼镜与深绿上衣，走进像素校园')
 .replace('深棕长发与刘海 · 粉白开衫 · 蓝色耳饰 · 浅蓝长裙。','蓬松黑发 · 细金属圆框眼镜 · 深绿短袖 · 炭灰长裤 · 米白运动鞋。')
 .replace('鞋子、背面及电动车为设计补全','长裤、鞋子、背面及奶油绿电动车为设计补全')
 .replace('缩小后耳饰、五官细节会丢失','缩小后眼镜、五官细节会丢失')
 .replace('源图仍有轻微半透明边缘，正式素材应继续清理。','透明度统计见来源记录；此处仅为静态外观与尺寸预览。')
 .replace(/const frames=\[[\s\S]*?\];/,'const frames='+JSON.stringify(frames)+';')
 .replace('Number(size.value)/448','Number(size.value)/'+(checks[0].boundsAtAlpha200.maxY-checks[0].boundsAtAlpha200.minY+1))
 .replace('sprite(cc,f,115,216,.43)','sprite(cc,f,115,216,'+Math.min(200/w,205/h)+')');
writeFileSync(new URL('preview.html',dir),html);
console.log(JSON.stringify(report,null,2));
