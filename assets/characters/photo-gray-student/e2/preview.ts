import * as Phaser from 'phaser';
import {validateManifest} from '/src/game/character/manifest';
import {ClipPlayer} from '/src/game/character/clip-player';
import {CharacterSprite,preloadCharacter} from '/src/game/character/character-sprite';
import {MovementKeys,bindMovementKeys} from '/src/game/input/movement-keys';
import {DEV_TUNING,nearestStandable,rasterizeWorld,step,footprintFits} from '/src/game/movement/movement';
import {validateAnnotation} from '/src/game/map-data';

const base=new URL('.',location.href).pathname;
const manifest=await fetch(base+'manifest.json').then(r=>r.json());
const problems=validateManifest(manifest);
if(problems.length)throw Error(problems.join('; '));
const images=new Map();
await Promise.all(manifest.sheets.map(async sheet=>{
  const image=new Image();image.src=base+sheet.url;await image.decode();
  if(image.width!==sheet.width||image.height!==sheet.height)throw Error('图片尺寸与 manifest 不符');
  images.set(sheet.id,image);
}));
const status=document.querySelector('#status');
status.textContent='已加载 2 张 PNG · 素材契约 16 个状态校验通过';
const sampleEntries=[];
const labels={down:'朝下 / 正面',left:'朝左',right:'朝右',up:'朝上 / 背面'};
let playing=true,singleStep=false,last=performance.now();
for(const mode of ['walk','ride'])for(const facing of ['down','left','right','up']){
  const div=document.createElement('div');div.className='card';
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=230;
  const span=document.createElement('span');span.textContent=(mode==='walk'?'步行':'骑行')+' · '+labels[facing];
  div.append(canvas,span);document.querySelector('#cards').append(div);
  sampleEntries.push({mode,facing,canvas,player:new ClipPlayer(manifest)});
}
function sampleFrame(now){
  const dt=Math.min(100,now-last);last=now;
  const factor=Number(document.querySelector('#speed').value);
  const stepNow=singleStep;singleStep=false;
  const action=document.querySelector('#idle').checked?'idle':'move';
  for(const e of sampleEntries){
    const advance=stepNow?(e.mode==='walk'?150:180):playing?dt*factor:0;
    const f=e.player.update({mode:e.mode,facing:e.facing,action},advance),r=f.rect,c=e.canvas.getContext('2d');
    c.clearRect(0,0,240,230);c.imageSmoothingEnabled=false;
    const scale=.63;c.drawImage(images.get(f.sheetId),r.x,r.y,r.width,r.height,120-f.anchor.x*scale,220-f.anchor.y*scale,r.width*scale,r.height*scale);
    c.strokeStyle='#d36f61';c.beginPath();c.moveTo(115,220);c.lineTo(125,220);c.moveTo(120,215);c.lineTo(120,225);c.stroke();
  }
  requestAnimationFrame(sampleFrame);
}
requestAnimationFrame(sampleFrame);
document.querySelector('#play').addEventListener('click',e=>{playing=!playing;e.target.textContent=playing?'暂停动画':'播放动画';e.target.classList.toggle('active',playing)});
document.querySelector('#step').addEventListener('click',()=>{playing=false;singleStep=true;document.querySelector('#play').textContent='播放动画';document.querySelector('#play').classList.remove('active')});

class ReviewScene extends Phaser.Scene{
  keys=new MovementKeys();character;world;start;state;annotation;unbind;
  constructor(){super('e2-character-review')}
  preload(){
    this.load.image('campus','/maps/campus-v20.png');
    this.load.json('annotation','/maps/campus-v20.annotations.json');
    preloadCharacter(this,base.replace(/\/$/,''));
  }
  create(){
    this.annotation=this.cache.json.get('annotation');
    const errors=validateAnnotation(this.annotation);if(errors.length)throw Error(errors.join('; '));
    this.world=rasterizeWorld(this.annotation,1041,1511);
    this.start=nearestStandable({x:565,y:972},DEV_TUNING.rideFootprint,this.world);
    if(!this.start)throw Error('地图中无可用预览落点');
    this.state={position:{...this.start},facing:'down',mode:'walk',moving:false};
    this.add.image(0,0,'campus').setOrigin(0).setDepth(-1000000);
    const result=CharacterSprite.create(this,.1);if('error' in result)throw Error(result.error);
    this.character=result;this.character.update(this.state,0);
    this.cameras.main.setZoom(2.3).setRoundPixels(true).centerOn(this.start.x,this.start.y);
    this.unbind=bindMovementKeys(this.keys);
    this.events.once('shutdown',()=>this.unbind());
    this.input.on('pointerdown',()=>{document.querySelector('#game').focus()});
    document.querySelector('#reset').addEventListener('click',()=>{this.keys.clear();this.state={position:{...this.start},facing:'down',mode:'walk',moving:false};document.querySelector('#game').focus()});
    document.querySelector('#scale').addEventListener('input',e=>{const scale=Number(e.target.value);this.character.image.setScale(scale);document.querySelector('#scaleValue').value=`约 ${Math.round(295*scale)} 地图像素高`});
    window.__e2={scene:this,manifest,problems,sampleEntries,getSnapshot:()=>this.snapshot()};
    window.previewReady=true;
  }
  update(time,dt){
    if(!this.character)return;
    this.state=step(this.state,this.keys.snapshot(),Math.min(dt,50)/1000,this.world,DEV_TUNING);
    this.character.update(this.state,dt);
    this.cameras.main.centerOn(this.state.position.x,this.state.position.y);
    const s=this.snapshot();
    document.querySelector('#readout').textContent=`${s.mode==='walk'?'步行':'骑行'} · ${labels[s.facing]} · ${s.moving?'移动':'待机'} | 落点 ${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)} | ${s.canStand?'当前碰撞范围有效':'当前碰撞范围无效'}`;
  }
  snapshot(){return {...this.state,position:{...this.state.position},canStand:footprintFits(this.state.position,this.state.mode==='ride'?DEV_TUNING.rideFootprint:DEV_TUNING.walkFootprint,this.world),spritePosition:{x:this.character.image.x,y:this.character.image.y},frame:this.character.currentFrameName,scale:this.character.image.scaleX,occluders:this.annotation.occluders.length}}
}
const host=document.querySelector('#game');
new Phaser.Game({type:Phaser.CANVAS,parent:host,width:host.clientWidth,height:410,pixelArt:true,roundPixels:true,backgroundColor:'#f0f2e6',scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},scene:[new ReviewScene()],audio:{noAudio:true},banner:false});
