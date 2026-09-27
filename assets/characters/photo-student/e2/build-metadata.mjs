/** Inspect original pixels and write frame metadata only; never alter the PNGs. */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../../tools/map/png.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const facings=['down','left','right','up'];
const sheets=[],clips=[],inspection=[];
for(const mode of ['walk','ride']){
  const url=`${mode}-cycle.png`,bytes=readFileSync(dir+url),im=decodePng(bytes);
  if(im.channels!==4||im.width!==1254||im.height!==1254)throw Error('Source PNG changed: inspect crop boundaries again');
  const xs=mode==='walk'?[125,375,625,875,1125]:[0,313,627,940,1254];
  const ys=[0,316,624,928,1254];
  const alpha={transparent:0,partial:0,opaque:0};
  for(let i=3;i<im.data.length;i+=4){const a=im.data[i];alpha[a===0?'transparent':a===255?'opaque':'partial']++}
  sheets.push({id:mode,url,width:im.width,height:im.height});
  const stats=[];
  for(let row=0;row<4;row++){
    const frames=[];
    for(let col=0;col<4;col++){
      const rect={x:xs[col],y:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]};
      let left=rect.width,top=rect.height,right=-1,bottom=-1,headSum=0,headN=0;
      for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++){
        if(im.data[((rect.y+y)*im.width+rect.x+x)*4+3]>127){
          left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
          if(y<85){headSum+=x;headN++}
        }
      }
      if(right<0||left===0||right===rect.width-1||top===0||bottom===rect.height-1)throw Error(`${mode}/${row}/${col} has empty or clipped silhouette`);
      let footLeft=rect.width,footRight=-1;
      for(let y=bottom-8;y<=bottom;y++)for(let x=0;x<rect.width;x++)if(im.data[((rect.y+y)*im.width+rect.x+x)*4+3]>127){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x)}
      // Walk: keep the torso axis over the ground point while shoes alternate.
      // Ride: use the midpoint of the contact patches, insensitive to hair movement.
      const anchor={x:mode==='walk'?Math.round(headSum/headN):Math.round((footLeft+footRight)/2),y:bottom+1};
      frames.push({sheetId:mode,rect,anchor,durationMs:mode==='walk'?150:180});
      stats.push({facing:facings[row],frame:col,bounds:{left,top,right,bottom},anchor,visibleHeight:bottom-top+1});
    }
    clips.push({mode,facing:facings[row],action:'idle',loop:true,frames:[{...frames[mode==='walk'?1:0],durationMs:700}]});
    clips.push({mode,facing:facings[row],action:'move',loop:true,frames});
  }
  inspection.push({url,sha256:createHash('sha256').update(bytes).digest('hex'),alpha,frames:stats});
}
const manifest={schemaVersion:1,characterId:'photo-student',sheets,clips};
writeFileSync(dir+'manifest.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync(dir+'inspection.json',JSON.stringify({stage:'E2',artStatus:'animation-sample',previewScale:0.1,inspection},null,2)+'\n');
console.log(JSON.stringify({sheets:sheets.length,states:clips.length,uniqueFrames:32,inspection:inspection.map(i=>({url:i.url,alpha:i.alpha,minHeight:Math.min(...i.frames.map(f=>f.visibleHeight)),maxHeight:Math.max(...i.frames.map(f=>f.visibleHeight))}))}));
