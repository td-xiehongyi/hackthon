import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../../tools/map/png.mjs';
const dir=new URL('./',import.meta.url),facings=['down','left','right','up'];
const sheets=[],clips=[],inspection=[];
for(const mode of ['walk','ride']){
 const url=mode+'-cycle-v3.png',bytes=readFileSync(new URL(url,dir)),im=decodePng(bytes);
 if(im.channels!==4)throw Error('RGBA required');
 const xs=Array.from({length:5},(_,i)=>Math.round(im.width*i/4));
 // Place row cuts inside measured transparent gutters near quarter divisions.
 const ys=[0];
 for(let i=1;i<4;i++){
  let bestY=0,bestCount=Infinity;
  for(let y=Math.round(im.height*i/4)-22;y<=Math.round(im.height*i/4)+22;y++){
   let count=0;for(let x=0;x<im.width;x++)if(im.data[(y*im.width+x)*4+3]>180)count++;
   const distance=Math.abs(y-im.height*i/4);
   if(count+distance*.001<bestCount){bestCount=count+distance*.001;bestY=y;}
  }
  ys.push(bestY);
 }
 ys.push(im.height);
 const alpha={transparent:0,partial:0,opaque:0};
 for(let i=3;i<im.data.length;i+=4){const a=im.data[i];alpha[a===0?'transparent':a===255?'opaque':'partial']++}
 sheets.push({id:mode,url,width:im.width,height:im.height});
 const stats=[];
 for(let row=0;row<4;row++){
  const frames=[];
  for(let col=0;col<4;col++){
   const rect={x:xs[col],y:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]};
   let left=rect.width,top=rect.height,right=-1,bottom=-1,headSum=0,headN=0;
   const solid=(x,y)=>im.data[((rect.y+y)*im.width+rect.x+x)*4+3]>180;
   for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   }
   if(right<0||left===0||right===rect.width-1||top===0||bottom===rect.height-1)throw Error(`${mode}/${row}/${col} clipped: ${JSON.stringify({left,top,right,bottom,rect})}`);
   for(let y=top;y<Math.min(top+40,rect.height);y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){headSum+=x;headN++}
   let footLeft=rect.width,footRight=-1;
   for(let y=Math.max(0,bottom-7);y<=bottom;y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x)}
   const anchor={x:mode==='walk'?Math.round(headSum/headN):Math.round((footLeft+footRight)/2),y:bottom+1};
   frames.push({sheetId:mode,rect,anchor,durationMs:mode==='walk'?150:180});
   stats.push({facing:facings[row],frame:col,bounds:{left,top,right,bottom},anchor,visibleHeight:bottom-top+1});
  }
  clips.push({mode,facing:facings[row],action:'idle',loop:true,frames:[{...frames[mode==='walk'?1:0],durationMs:700}]});
  clips.push({mode,facing:facings[row],action:'move',loop:true,frames});
 }
 inspection.push({url,sha256:createHash('sha256').update(bytes).digest('hex'),width:im.width,height:im.height,xs,ys,alpha,frames:stats});
}
writeFileSync(new URL('manifest.json',dir),JSON.stringify({schemaVersion:1,characterId:'yellow-belly-creature',sheets,clips},null,2)+'\n');
writeFileSync(new URL('inspection.json',dir),JSON.stringify({stage:'E2',status:'awaiting-animation-review',sourceFrames:32,selectedUniqueFrames:32,inspection},null,2)+'\n');
let html=readFileSync(new URL('../../photo-sage-student/e2/preview.html',dir),'utf8')
 .replace('棕发绿包女生','黄肚肚 · 肚子加大版')
 .replace('外观已确认 · 当前为动画小样。','基础外观已确认；肚子按要求稍加大，当前为 v3 动画小样。')
 .replace('展示步行摆臂与收腿','展示短腿迈步与收腿')
 .replace('侧面步幅已增强；正面第 4 源帧包带反向，已排除并复用第 2 帧，当前正面采用 3 个有效姿态循环。','每方向 4 帧；已修正朝左行中混入朝右帧的问题。动作衔接、侧面腹斑和边缘杂色仍待审阅。')
 .replace('32 个源帧，其中 31 个入选','32 个源帧，全部入选')
 .replaceAll('约 30 地图像素高','约 29 地图像素高')
 .replaceAll('0.10','0.11').replace('value="0.11"','value="0.11"');
writeFileSync(new URL('preview.html',dir),html);
let ts=readFileSync(new URL('../../photo-sage-student/e2/preview.ts',dir),'utf8')
 .replace('CharacterSprite.create(this,.1)','CharacterSprite.create(this,.11)')
 .replace('Math.round(295*scale)','Math.round(265*scale)');
writeFileSync(new URL('preview.ts',dir),ts);
let verify=readFileSync(new URL('../../photo-sage-student/e2/verify-review.mjs',dir),'utf8')
 .replace('5199/assets/characters/photo-sage-student','5214/assets/characters/yellow-belly-creature')
 .replace('Weak-alpha edges, front gait legibility and excluded mirrored-bag frame remain art-review items.','Weak-alpha/color fringes, side-view belly patch consistency, gait continuity and wheel motion remain art-review items.')
 .replace('scale 0.10','scale 0.11');
writeFileSync(new URL('verify-review.mjs',dir),verify);
console.log(JSON.stringify({states:clips.length,frames:32,inspection:inspection.map(({frames,...s})=>({...s,heights:frames.map(f=>f.visibleHeight)}))},null,2));
