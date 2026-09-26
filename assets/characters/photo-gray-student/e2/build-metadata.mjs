/** Inspect original image pixels; write metadata only. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../../tools/map/png.mjs';
const dir=new URL('./',import.meta.url),facings=['down','left','right','up'];
const sheets=[],clips=[],inspection=[];
for(const mode of ['walk','ride']){
 const url=mode==='walk'?'walk-cycle.png':'ride-cycle.png';
 const bytes=readFileSync(new URL(url,dir)),im=decodePng(bytes);
 if(im.channels!==4||im.width!==1254||im.height!==1254)throw Error('Unexpected PNG dimensions');
 const xs=[0,313,627,940,1254],ys=mode==='walk'?[0,315,626,938,1254]:[0,320,627,938,1254];
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
   for(let y=top;y<Math.min(top+60,rect.height);y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){headSum+=x;headN++}
   let footLeft=rect.width,footRight=-1;
   for(let y=Math.max(0,bottom-7);y<=bottom;y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x)}
   const anchor={x:mode==='walk'?Math.round(headSum/headN):Math.round((footLeft+footRight)/2),y:bottom+1};
   frames.push({sheetId:mode,rect,anchor,durationMs:mode==='walk'?150:180});
   stats.push({facing:facings[row],frame:col,bounds:{left,top,right,bottom},anchor,visibleHeight:bottom-top+1,excluded:false});
  }
  const sequence=frames;
  clips.push({mode,facing:facings[row],action:'idle',loop:true,frames:[{...frames[mode==='walk'?1:0],durationMs:700}]});
  clips.push({mode,facing:facings[row],action:'move',loop:true,frames:sequence});
 }
 inspection.push({url,sha256:createHash('sha256').update(bytes).digest('hex'),alpha,frames:stats});
}
writeFileSync(new URL('manifest.json',dir),JSON.stringify({schemaVersion:1,characterId:'photo-gray-student',sheets,clips},null,2)+'\n');
writeFileSync(new URL('inspection.json',dir),JSON.stringify({stage:'E2',status:'animation-sample',sourceFrames:32,selectedUniqueFrames:32,excluded:[],inspection},null,2)+'\n');
console.log(JSON.stringify({states:clips.length,selectedUniqueFrames:32,images:inspection.map(i=>({url:i.url,alpha:i.alpha,minHeight:Math.min(...i.frames.map(f=>f.visibleHeight)),maxHeight:Math.max(...i.frames.map(f=>f.visibleHeight))}))}));
