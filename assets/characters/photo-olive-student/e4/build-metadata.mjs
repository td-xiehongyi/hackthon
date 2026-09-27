import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodePng} from '../../../../tools/map/png.mjs';
import {validateManifest} from '../../../../src/game/character/manifest.ts';
const dir=new URL('./',import.meta.url);
const old=JSON.parse(readFileSync(new URL('../e3/manifest.json',dir),'utf8'));
const manifest=structuredClone(old);
const bytes=readFileSync(new URL('walk-sides-v2.png',dir)),p=decodePng(bytes);
if(p.width!==1254||p.height!==1254||p.channels!==4)throw Error('Unexpected image format');
manifest.sheets.push({id:'walk-sides-v2',url:'walk-sides-v2.png',width:p.width,height:p.height});
const xs=[0,313,627,940,1254],ys=[0,317,621,922,1254],stats=[];
for(const [row,facing] of [[1,'left'],[2,'right']]){
 const frames=[];
 for(let col=0;col<4;col++){
  const rect={x:xs[col],y:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]};
  const solid=(x,y)=>p.data[((rect.y+y)*p.width+rect.x+x)*4+3]>180;
  let left=rect.width,top=rect.height,right=-1,bottom=-1,sum=0,n=0;
  for(let y=0;y<rect.height;y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<0||left===0||top===0||right===rect.width-1||bottom===rect.height-1)throw Error('Clipped '+facing+'/'+col);
  for(let y=top;y<top+60;y++)for(let x=0;x<rect.width;x++)if(solid(x,y)){sum+=x;n++;}
  const anchor={x:Math.round(sum/n),y:bottom+1};
  frames.push({sheetId:'walk-sides-v2',rect,anchor,durationMs:150});
  stats.push({facing,frame:col,bounds:{left,top,right,bottom},anchor,height:bottom-top+1,headTopAboveGround:anchor.y-top});
 }
 manifest.clips.find(c=>c.mode==='walk'&&c.facing===facing&&c.action==='move').frames=frames;
}
const problems=validateManifest(manifest);if(problems.length)throw Error(problems.join(';'));
const changes=manifest.clips.filter((c,i)=>JSON.stringify(c)!==JSON.stringify(old.clips[i]));
if(changes.length!==2||changes.some(c=>c.mode!=='walk'||c.action!=='move'||!['left','right'].includes(c.facing)))throw Error('Unexpected state changes');
const alpha={transparent:0,partial:0,opaque:0};for(let i=3;i<p.data.length;i+=4)alpha[p.data[i]===0?'transparent':p.data[i]===255?'opaque':'partial']++;
const report={stage:'E4',status:'side-walk-revision-visually-approved',approvedOn:'2026-09-27',sha256:createHash('sha256').update(bytes).digest('hex'),width:p.width,height:p.height,alpha,replacedClips:changes.map(c=>c.mode+'/'+c.facing+'/'+c.action),unchangedClips:14,frames:stats,problems};
writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(new URL('inspection.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
