'use strict';
const $ = (selector) => document.querySelector(selector);
// Keep the large inline image out of CSS custom properties, whose parsed value is size-limited.
const mapImage = '__MAP_IMAGE__';
$('.map-bg').style.backgroundImage = `linear-gradient(#16362980,#15392a99),url("${mapImage}")`;
$('#place-art').style.backgroundImage = `url("${mapImage}")`;
const iconPaths = {
  campus:'<path d="M3 20V9h18v11M1 20h22M1 9l11-7 11 7M7 12v3m5-3v3m5-3v3M10 20v-3h4v3"/>',
  book:'<path d="M12 5v16M12 6C8 3 5 3 2 4v15c4-1 6 0 10 2 4-2 6-3 10-2V4c-3-1-6-1-10 2Z"/>',
  calendar:'<path d="M3 5h18v16H3zM7 2v6m10-6v6M3 10h18M7 14h3m4 0h3m-10 3h3"/>',
  grid:'<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>',
  photo:'<path d="M3 4h18v16H3zM3 16l6-6 5 5 3-3 4 4"/><path d="M16 7h1v1h-1z"/>',
  settings:'<path d="M3 6h18M3 12h18M3 18h18M7 3v6m10 0v6M9 15v6"/>',
  back:'<path d="m9 5-7 7 7 7M2 12h19"/>',
  pin:'<path d="M19 9c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 14 0Z"/><path d="M10 7h4v4h-4z"/>',
  flag:'<path d="M5 22V3h14l-3 4 3 4H5"/>',
  people:'<path d="M8 3h4v5H8zM3 21v-7l3-3h8l3 3v7M16 4h3v4h-3m3 3 3 3v7"/>',
  left:'<path d="m15 4-8 8 8 8"/>',
  right:'<path d="m9 4 8 8-8 8"/>',
  close:'<path d="m5 5 14 14M5 19 19 5"/>',
  leaf:'<path d="M20 3C8 2 2 7 5 16c8 4 14 0 15-13ZM3 21 15 9"/>',
  search:'<path d="m16 16 6 6"/><circle cx="10" cy="10" r="7"/>',
  upload:'<path d="M3 14v7h18v-7M12 17V2M6 8l6-6 6 6"/>',
  plus:'<path d="M12 3v18M3 12h18"/>',
  download:'<path d="M3 14v7h18v-7M12 2v14M6 10l6 6 6-6"/>',
  warning:'<path d="m12 2 11 20H1ZM12 8v6m0 3v2"/>',
  file:'<path d="M5 2h10l5 5v15H5ZM14 2v6h6M9 12h7m-7 4h7"/>',
  sun:'<path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/><circle cx="12" cy="12" r="5"/>'
};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name]||iconPaths.leaf}</svg>`;}
function fillIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const photos = {
  teaching:'__TEACHING_IMAGE__', library:'__LIBRARY_IMAGE__', stadium:'__STADIUM_IMAGE__'
};
const places = {
  teaching:{id:'xiaoxiang_teaching_group',name:'教学楼群',full:'潇湘校区教学楼群',num:'01',english:'A DAY OF LEARNING',title:'今天，也要学有所获。',subtitle:'把一周的计划，放进校园的日常。',tabs:[['today','calendar','我的课表'],['week','grid','完整周课表'],['manage','settings','课表管理'],['album','photo','地点相册']]},
  library:{id:'xiaoxiang_library',name:'图书馆',full:'潇湘校区图书馆',num:'02',english:'BETWEEN THE PAGES',title:'在书页之间，慢一点。',subtitle:'认识这处校园风景，收藏你眼中的图书馆。',tabs:[['intro','book','地点介绍'],['album','photo','地点相册']]},
  stadium:{id:'xiaoxiang_sports_ground',name:'操场',full:'潇湘校区操场',num:'03',english:'MEET OUTSIDE',title:'课余的精彩，在这里相遇。',subtitle:'发现社团与活动，把喜欢的事变成日常。',tabs:[['events','flag','校园活动'],['clubs','people','社团目录'],['album','photo','地点相册']]}
};
let place='teaching', tab='today', mode='demo', building='all', week=4;
let activityCategory='all', activityCampus='all', activityDate='', search='';
const albums=Object.fromEntries(Object.values(places).map(p=>[p.id,[]]));
const courses=[
 {id:1,name:'高等数学',building:'A',room:'示例 203',day:2,start:1,end:2,weeks:[1,16],parity:'all',color:'green'},
 {id:2,name:'数据结构',building:'B',room:'示例 305',day:2,start:3,end:4,weeks:[1,16],parity:'even',color:'gold'},
 {id:3,name:'大学英语',building:'A',room:'示例 107',day:2,start:7,end:8,weeks:[1,16],parity:'all',color:'blue'},
 {id:4,name:'线性代数',building:'B',room:'示例 201',day:1,start:3,end:4,weeks:[1,16],parity:'all',color:'gold'},
 {id:5,name:'程序设计',building:'A',room:'示例 402',day:3,start:1,end:2,weeks:[1,16],parity:'all',color:'green'},
 {id:6,name:'大学物理',building:'B',room:'示例 202',day:4,start:5,end:6,weeks:[1,16],parity:'all',color:'blue'},
 {id:7,name:'高等数学',building:'A',room:'示例 203',day:5,start:1,end:2,weeks:[1,16],parity:'all',color:'green'},
 {id:8,name:'程序设计实验',building:'B',room:'示例 401',day:3,start:5,end:6,weeks:[1,16],parity:'odd',color:'gold'}
];
const activities=[
 {id:1,name:'一起跑进晚风里',club:'示例跑步社',category:'体育运动',campus:'潇湘校区',venue:'示例场地 · 校园田径场',date:'2026-09-26',time:'17:30—18:30',day:'26',month:'SEP',status:'即将开始',text:'以轻松的配速认识新朋友。活动时间、主办社团与场地均为界面演示内容，请勿据此参加实际活动。'},
 {id:2,name:'用镜头收集校园的秋天',club:'示例摄影社',category:'文化艺术',campus:'岳麓山校区',venue:'示例场地 · 校园广场',date:'2026-09-27',time:'15:00—17:00',day:'27',month:'SEP',status:'即将开始',text:'从熟悉的校园出发，练习光影与构图。此条用于展示跨校区活动，查询入口与活动实际地点分别显示。'},
 {id:3,name:'草地上的不插电音乐会',club:'示例音乐社',category:'文化艺术',campus:'麓南校区',venue:'示例场地 · 湖畔草坪',date:'2026-09-20',time:'18:00—19:30',day:'20',month:'SEP',status:'已结束',text:'这是一条已经结束的示例活动，用来检查历史活动的视觉状态，不代表真实演出。'}
];
const clubs=[
 {name:'示例跑步社',category:'体育运动',symbol:'flag',desc:'和伙伴一起慢跑、交流训练心得，在运动中认识校园。'},
 {name:'示例摄影社',category:'文化艺术',symbol:'photo',desc:'用镜头记录校园，分享摄影作品与构图练习。'},
 {name:'示例音乐社',category:'文化艺术',symbol:'sun',desc:'从一首喜欢的歌开始，寻找一起演奏的朋友。'},
 {name:'示例编程社',category:'学术科技',symbol:'grid',desc:'交流程序设计与创意项目，让想法慢慢成为作品。'}
];
function sceneSvg(type){
 let shapes='';
 if(type==='teaching'){
  shapes='<rect width="850" height="220" fill="#e9e0bc"/><rect y="151" width="850" height="69" fill="#c7bd8e"/><path d="M0 171H850M0 195H850M200 151 130 220M370 151 350 220M540 151 570 220M710 151 790 220" stroke="#e4d9b0" stroke-width="3"/><rect x="385" y="25" width="260" height="112" fill="#80957c"/><rect x="392" y="32" width="246" height="98" fill="#d9ead6"/><path d="M391 100 460 69 515 96 580 50 639 67V132H391Z" fill="#aabe8b"/><path d="M401 109 450 94 510 116 564 81 638 103V130H401Z" fill="#91aa71"/><path d="M473 32V130M555 32V130M391 77H639" stroke="#72896c" stroke-width="6"/><rect x="377" y="136" width="277" height="8" fill="#aa9f76"/><rect x="696" y="22" width="81" height="137" fill="#afa579"/><rect x="704" y="30" width="65" height="128" fill="#788969"/><rect x="712" y="39" width="49" height="56" fill="#c5d1b2"/><rect x="750" y="111" width="5" height="12" fill="#f0db95"/><rect x="501" y="169" width="131" height="9" fill="#826e47"/><rect x="510" y="178" width="7" height="24" fill="#6b6144"/><rect x="616" y="178" width="7" height="24" fill="#6b6144"/><rect x="511" y="154" width="110" height="8" fill="#a28957"/><path d="M511 156V175M621 156V175" stroke="#786745" stroke-width="5"/><rect x="809" y="135" width="27" height="30" fill="#a58453"/><path d="M822 139V90" stroke="#6e8c5a" stroke-width="6"/><path d="M797 102h20v19h-20M824 90h19v23h-19M807 74h23v24h-23" fill="#8da46c"/>';
 }else if(type==='library'){
  shapes='<rect width="850" height="220" fill="#e1e3c7"/><rect y="161" width="850" height="59" fill="#c2c49d"/>';
  for(let i=0;i<4;i++){const x=395+i*108;shapes+=`<rect x="${x}" y="20" width="87" height="145" fill="#7e8461"/><rect x="${x+7}" y="26" width="73" height="133" fill="#525f46"/>`;for(let r=0;r<3;r++){shapes+=`<rect x="${x+6}" y="${64+r*44}" width="75" height="5" fill="#a09c6b"/>`;for(let b=0;b<7;b++){const colors=['#bec191','#cbae7b','#8ea48b','#c7b696'];shapes+=`<rect x="${x+11+b*9}" y="${33+r*44+(b%3)*3}" width="7" height="${31-(b%3)*3}" fill="${colors[(i+b+r)%4]}"/>`;}}}
  shapes+='<rect x="478" y="178" width="211" height="9" fill="#9e9165"/><rect x="491" y="186" width="9" height="34" fill="#7a7d54"/><rect x="667" y="186" width="9" height="34" fill="#7a7d54"/><path d="M569 150v27m-20-27h40l-10-22h-20Z" fill="#e2d59a" stroke="#969c66" stroke-width="3"/>';
 }else{
  shapes='<rect width="850" height="220" fill="#d7e6cb"/><path d="M315 114h48V84h32v24h40V69h30v22h42V54h31v52h61V75h35v29h53V65h42v38h31V85h40v54H315Z" fill="#aac591"/><rect y="132" width="850" height="88" fill="#99b26e"/><path d="M350 214c60-96 201-106 384-94l73 83" fill="none" stroke="#c99577" stroke-width="62"/><path d="M352 219c64-94 201-103 380-90l67 80M353 228c67-94 201-103 374-90l67 80" fill="none" stroke="#e1c1a0" stroke-width="2"/><path d="M525 177h139v-31H525Zm69-31v31" fill="none" stroke="#dde4b2" stroke-width="2"/><path d="M757 119V69h51v59m-51-52h51" fill="none" stroke="#eff1d5" stroke-width="4"/><rect x="438" y="143" width="8" height="11" fill="#d3ac86"/><rect x="435" y="154" width="14" height="15" fill="#536c61"/><path d="m435 169-6 15m16-15 7 12M435 156l-11 8m24-8 11-7" stroke="#66795b" stroke-width="5"/>';
 }
 return `<svg class="scene" viewBox="0 0 850 220" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true">${shapes}</svg>`;
}
function head(title,subtitle,actions=''){return `<div class="content-head"><div><h3>${title}</h3><p>${subtitle}</p></div>${actions||'<span class="badge">演示数据</span>'}</div>`;}
function button(label,action,ico='',secondary=false){return `<button class="btn${secondary?' secondary':''}" data-action="${action}">${ico?icon(ico):''}${label}</button>`;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5500);}
function showModal(title,body){$('#modal-title').textContent=title;$('#modal-body').innerHTML=body;fillIcons($('#modal'));if(!$('#modal').open)$('#modal').showModal();}
function closeModal(){$('#modal').close();}
function setPlace(next){
 if(!places[next])return;
 if($('#modal').open)closeModal();
 place=next;tab=places[place].tabs[0][0];building='all';search='';activityCategory='all';activityCampus='all';activityDate='';
 $('#panel').hidden=false;$('#campus-return').hidden=true;$('.pause').innerHTML='<i class="status-dot"></i>正在地点互动';render();
}
function render(){
 const p=places[place];
 $('.preview-label span').textContent='地点交互界面 · '+p.num;
 document.querySelectorAll('.segmented [data-place]').forEach(el=>{el.classList.toggle('active',el.dataset.place===place);el.setAttribute('aria-pressed',String(el.dataset.place===place));});
 $('#place-title').textContent=p.name;$('#place-code').textContent=`PLACE / ${p.num}`;$('#place-art').className=`place-art ${place}`;
 $('#place-nav').innerHTML=p.tabs.map(([id,ico,label])=>`<button data-tab="${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}>${icon(ico)}${label}${id==='album'?'<span class="count">PHOTO</span>':''}</button>`).join('');
 $('#scene-hero').innerHTML=`${sceneSvg(place)}<div class="hero-copy"><div class="eyebrow">${p.english}</div><h2>${p.title}</h2><p>${p.subtitle}</p></div><span class="scene-caption">${place==='teaching'?'教学楼内':place==='library'?'阅读空间':'操场'} · 像素背景示意</span>`;
 $('#footer-place').textContent=p.full+' · '+(tab==='album'?'独立地点相册':'地点专属内容');
 renderContent();
}
function renderContent(){
 const content=$('#content');
 if(mode==='error'){
  content.innerHTML=head('内容暂时没有读到','读取失败状态 · 仅用于演示界面反馈','<span class="badge rose">失败状态预览</span>')+empty('warning','暂时无法读取内容','已有内容不会被覆盖。正式应用将在这里提示原因，并提供重试入口。',button('重试预览','retry','right'),true);return;
 }
 if(tab==='album'){renderAlbum();return;}
 if(place==='teaching'){
  if(tab==='manage'){renderManage();return;}
  if(mode==='empty'){content.innerHTML=head(tab==='week'?'完整周课表':'我的课表','还没有个人课程','<span class="badge green">空状态</span>')+empty('calendar','把第一门课放进校园','录入课程或导入课表后，便可以在这里按楼座与教学周查看。',button('前往课表管理','go-manage','plus'));return;}
  if(tab==='week')renderWeek();else renderToday();
 }else if(place==='library'){renderIntro();}else if(tab==='clubs'){renderClubs();}else{renderEvents();}
}
function empty(ico,title,description,action='',error=false){return `<div class="empty-state${error?' error-state':''}"><div class="empty-art">${icon(ico)}</div><h4>${title}</h4><p>${description}</p>${action}</div>`;}
function courseFilter(c){return (building==='all'||c.building===building)&&week>=c.weeks[0]&&week<=c.weeks[1]&&(c.parity==='all'||(c.parity==='even'?week%2===0:week%2===1));}
function weekRule(c){return `第 ${c.weeks[0]}–${c.weeks[1]} 周${c.parity==='all'?'':c.parity==='even'?' · 双周':' · 单周'}`;}
function scheduleToolbar(){return `<div class="toolbar"><div class="chips" aria-label="楼座筛选">${[['all','全部楼座'],['A','示例楼座 A'],['B','示例楼座 B']].map(([id,label])=>`<button class="chip ${building===id?'active':''}" data-building="${id}" aria-pressed="${building===id}">${label}</button>`).join('')}</div><div class="week-picker"><button class="square-btn" data-action="prev-week" aria-label="上一教学周" ${week===1?'disabled':''}>${icon('left')}</button><span>第 <b class="mono">${String(week).padStart(2,'0')}</b> 周</span><button class="square-btn" data-action="next-week" aria-label="下一教学周" ${week===20?'disabled':''}>${icon('right')}</button></div></div>`;}
function renderToday(){
 const list=courses.filter(c=>c.day===2&&courseFilter(c));
 $('#content').innerHTML=head('我的课表','示例教学周 · 周二 / 按节次查看个人课程')+scheduleToolbar()+`<div class="schedule-layout"><div class="schedule-list">${list.map(c=>`<article class="course"><div class="course-time mono">${String(c.start).padStart(2,'0')}–${String(c.end).padStart(2,'0')}<span>节次</span></div><div><h4>${escapeHtml(c.name)}</h4><div class="course-info"><span>示例楼座 ${c.building} · ${escapeHtml(c.room)}</span><span>示例教师</span></div><div class="course-note">${weekRule(c)}</div></div><button class="text-btn" data-action="locate">${icon('pin')}定位</button></article>`).join('')||empty('calendar','这一天没有课程','试试其他楼座或教学周。')}</div><aside class="schedule-aside"><div class="day-card"><div class="weekday">演示日 / 星期二</div><div class="date">${String(week).padStart(2,'0')}<span>周</span></div><span class="badge green">示例学期</span><hr><p>当天有 <strong>${list.length}</strong> 门课<br>一段学习，一段成长。</p></div><p class="small-note">课程与楼座仅作效果演示。<br>实际楼座清单、学期与节次时间仍待配置。</p></aside></div>`;
}
function renderWeek(){
 const filtered=courses.filter(courseFilter);let cells='<div class="day-heading">节次</div>'+['周一','周二','周三','周四','周五','周六','周日'].map(d=>`<div class="day-heading">${d}</div>`).join('');
 for(let start=1;start<=9;start+=2){cells+=`<div class="period mono">${start}–${start+1}</div>`;for(let day=1;day<=7;day++){const found=filtered.filter(c=>c.day===day&&c.start===start);cells+=`<div>${found.map(c=>`<div class="week-course ${c.color}">${escapeHtml(c.name)}<br><span class="tiny">示例 ${c.building} · ${escapeHtml(c.room.replace('示例 ',''))}</span></div>`).join('')}</div>`;}}
 $('#content').innerHTML=head('完整周课表','同一入口，查看整周个人安排')+scheduleToolbar()+`<div class="week-grid-wrap"><div class="week-grid">${cells}</div></div><p class="small-note">切换教学周可查看单双周变化；空白格仅表示示例个人课表无课，不表示教室空闲。</p>`;
}
function renderIntro(){
 $('#content').innerHTML=head('地点介绍','校园很大，从认识一处风景开始。','<span class="badge green">地点资料</span>')+`<div class="library-layout"><figure class="reference-photo"><img src="${photos.library}" alt="项目已有的潇湘校区图书馆外观参考照片"><figcaption>项目已有外观参考 · 非用户上传的相册图片</figcaption></figure><div><dl class="info-list"><dt>地点名称</dt><dd>潇湘校区图书馆</dd><dt>所属校区</dt><dd>潇湘校区</dd><dt>地点简介</dt><dd class="muted">${mode==='empty'?'尚未录入地点介绍。':'正式介绍待补充，暂不展示未经核实的开放时间与服务信息。'}</dd><dt>资料来源</dt><dd class="muted">介绍正文暂无来源</dd></dl><div class="info-box">这处地点也有自己的相册。<br>把你看到的图书馆，留在这里。<button class="text-btn" data-tab="album">查看地点相册 ${icon('right')}</button></div></div></div><p class="small-note">参考照片沿用项目素材记录；本预览没有将待补充介绍自动改成真实校园信息。</p>`;
}
function eventFilters(isClubs=false){return `<div class="filters"><label class="searchbox">${icon('search')}<input id="content-search" aria-label="搜索${isClubs?'社团':'活动'}" placeholder="搜索${isClubs?'社团名称或简介':'活动名称、社团或地点'}" value="${escapeHtml(search)}"></label><select id="category-filter" aria-label="按类别筛选"><option value="all">全部类别</option>${['体育运动','文化艺术','学术科技'].map(x=>`<option ${activityCategory===x?'selected':''}>${x}</option>`).join('')}</select>${!isClubs?`<select id="campus-filter" aria-label="按校区筛选"><option value="all">全部校区</option>${['潇湘校区','岳麓山校区','麓南校区'].map(x=>`<option ${activityCampus===x?'selected':''}>${x}</option>`).join('')}</select><input type="date" id="date-filter" aria-label="按活动日期筛选" value="${activityDate}">`:''}</div>`;}
function renderEvents(){
 $('#content').innerHTML=head('校园活动','从操场出发，发现整个校园的热闹。')+eventFilters()+'<div id="event-results"></div><p class="small-note">演示时间固定为 2026-09-26 14:00；实际活动地点单独显示，不等于当前查询入口。</p>';
 updateEventResults();
}
function updateEventResults(){
 const list=mode==='empty'?[]:activities.filter(a=>(activityCategory==='all'||a.category===activityCategory)&&(activityCampus==='all'||a.campus===activityCampus)&&(!activityDate||a.date===activityDate)&&`${a.name}${a.club}${a.venue}`.includes(search));
 $('#event-results').innerHTML=list.length?`<div class="activities">${list.map(a=>`<article class="activity-card ${a.status==='已结束'?'ended':''}"><div class="activity-date"><strong>${a.day}</strong><span>${a.month} / 2026</span></div><div><h4>${a.name}</h4><p>${a.club} · ${a.time}</p><p class="venue">${a.campus} · ${a.venue}</p></div><div class="activity-side"><span class="badge ${a.status==='已结束'?'':'green'}">${a.status}</span><button class="text-btn" data-event="${a.id}">查看详情 ${icon('right')}</button></div></article>`).join('')}</div>`:empty('flag',mode==='empty'?'校园活动，等你来发现':'没有找到匹配的活动',mode==='empty'?'还没有录入活动。发布后的活动将在这里按日期与类别展示。':'试着调整关键词、类别、日期或校区。',mode==='empty'?'':button('清除筛选','clear-filters','back',true));
}
function renderClubs(){
 $('#content').innerHTML=head('社团目录','找一群同路人，把热爱分享出去。')+eventFilters(true)+'<div id="club-results"></div><p class="small-note">所有社团均为演示条目；公开链接尚未配置，不提供虚构的加入或报名入口。</p>';
 updateClubResults();
}
function updateClubResults(){const list=mode==='empty'?[]:clubs.filter(c=>(activityCategory==='all'||c.category===activityCategory)&&`${c.name}${c.desc}`.includes(search));$('#club-results').innerHTML=list.length?`<div class="clubs">${list.map(c=>`<article class="club"><div class="club-head"><div class="club-symbol">${icon(c.symbol)}</div><div><h4>${c.name}</h4><span class="tiny muted">${c.category}</span></div></div><p>${c.desc}</p><button class="text-btn" data-action="club-link" style="margin-top:12px">公开链接待补充 ${icon('right')}</button></article>`).join('')}</div>`:empty('people',mode==='empty'?'这里还没有社团资料':'没有找到匹配的社团',mode==='empty'?'正式社团信息录入后，会出现在这里。':'试试其他关键词或类别。',mode==='empty'?'':button('清除筛选','clear-filters','back',true));}
function albumItems(){return mode==='empty'?[]:[{src:photos[place],name:'建筑外观 · 项目参考素材',reference:true},...albums[places[place].id]];}
function renderAlbum(){
 const items=albumItems(),p=places[place];
 $('#content').innerHTML=head('地点相册',`${p.name}的片段，慢慢收藏。`,button('选择图片预览','upload','upload'))+`<div class="toolbar"><span class="small muted">${items.length} 张图片 · 仅属于${p.name}</span><span class="badge">临时预览 · 刷新后清空</span></div>`+(items.length?`<div class="photo-grid">${items.map((photo,i)=>`<button class="photo-card" data-photo="${i}" aria-label="放大查看：${escapeHtml(photo.name)}"><img src="${photo.src}" alt="${escapeHtml(photo.name)}"><span class="expand">⌕</span><figcaption>${escapeHtml(photo.name)}</figcaption></button>`).join('')}<button class="upload-card" data-action="upload">${icon('plus')}留下这个地点的第一眼</button></div>`:empty('photo','相册还是空的','从电脑中选择一张照片，预览它出现在当前地点相册里的样子。',button('选择第一张图片','upload','plus')))+`<div class="upload-note">此 HTML 仅演示选图与查看，图片暂存在当前页面内存中；不会写入项目相册。演示参考图与用户所选图片分别标注。</div>`;
}
function renderManage(){
 $('#content').innerHTML=head('课表管理','把自己的课程，安排得井井有条。','<span class="badge">操作流程示意</span>')+`<div class="manage-grid"><article class="manage-card">${icon('file')}<h4>导入 CSV 课表</h4><p>先检查课程字段，再预览导入内容。<br>异常内容保留原始信息并明确提示。</p>${button('查看导入流程','import-preview','upload')}</article><article class="manage-card">${icon('calendar')}<h4>维护个人课程</h4><p>查看新增课程的表单，或导出演示数据，<br>了解个人课表的管理方式。</p>${button('新增课程示意','new-course','plus',true)}<button class="text-btn" style="margin-top:14px" data-action="export">${icon('download')}导出演示课表 JSON</button></article></div><div class="manage-note">当前学期：尚未配置 · 学期起始日、总周数和节次时间仍待确定。<br>本预览不清空、替换或读写真实个人课表。</div>`;
}
function eventDetail(id){const a=activities.find(x=>x.id===id);if(!a)return;showModal(a.name,`<span class="badge">演示活动</span><dl class="info-list" style="margin-top:18px"><dt>主办社团</dt><dd>${a.club}</dd><dt>活动时间</dt><dd>${a.date} ${a.time}</dd><dt>实际地点</dt><dd>${a.campus} · ${a.venue}</dd><dt>状态</dt><dd>${a.status}</dd><dt>信息来源</dt><dd>界面演示，无真实活动链接</dd></dl><p style="margin-top:20px">${a.text}</p>`);}
function downloadDemo(){const data=JSON.stringify({kind:'ui-preview-demo',notice:'仅为界面示例，非真实个人课表，非正式备份格式',courses},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='像素校园-演示课表.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出演示 JSON；这不是正式课表备份格式。');}
const actions={
 'retry':()=>{mode='demo';$('#preview-state').value=mode;renderContent();toast('已切回演示数据，展示重试后的界面效果。');},
 'go-manage':()=>{tab='manage';render();},
 'prev-week':()=>{week=Math.max(1,week-1);renderContent();},
 'next-week':()=>{week=Math.min(20,week+1);renderContent();},
 'locate':()=>toast('该示例楼座尚无已核验的地图位置，暂不能定位。'),
 'clear-filters':()=>{search='';activityCategory='all';activityCampus='all';activityDate='';renderContent();},
 'club-link':()=>toast('演示社团尚未配置公开链接。'),
 'upload':()=>{$('#photo-input').value='';$('#photo-input').dataset.place=place;$('#photo-input').click();},
 'export':downloadDemo,
 'import-preview':()=>showModal('CSV 导入 · 流程示意',`<span class="badge">导入方案尚待确认</span><p>正式功能会从本机选择 CSV。本预览使用两条示例数据展示校验结果。</p><div class="info-box"><b>高等数学</b> · 星期二 · 1—2 节<br>楼座原文：示例楼座 A<br><span class="muted">地点尚未匹配，将保留原始文字。</span></div><div class="info-box" style="border-color:#dfbba3;background:#f4e7d9"><b>数据结构</b> · 星期二 · 3—4 节<br>周次字段缺失，需修正后重新导入。</div><p>导入校验失败时，不覆盖已有课表。</p>${button('查看修正后效果','import-valid','right')}`),
 'import-valid':()=>showModal('CSV 导入 · 预览结果',`<span class="badge green">示例字段校验通过</span><p>2 条课程可以进入导入预览；1 个地点仍待匹配。原始地点文字保留，等待确认。</p><div class="info-box">追加、替换、重复与冲突处理方案仍待确认。本页面仅展示状态，不执行真实导入。</div>${button('完成流程预览','finish-import','right')}`),
 'finish-import':()=>{closeModal();toast('导入流程预览结束，没有写入或替换任何课表。');},
 'new-course':()=>showModal('新增课程 · 表单预览',`<span class="badge">只预览表单，不保存真实课程</span><form id="course-preview-form"><label>课程名称<input name="course" placeholder="例如：高等数学" required maxlength="60"></label><label>教师<input name="teacher" placeholder="填写任课教师" maxlength="60"></label><label>星期 / 节次<input value="星期二 · 第 1—2 节" readonly></label><label>周次<input value="第 1—16 周 · 每周" readonly></label><label>楼座 / 教室<input value="示例楼座 A · 示例 203" readonly></label><button class="btn" style="margin-top:15px" type="submit">查看保存反馈</button></form>`)
};
document.addEventListener('click',event=>{
 const target=event.target.closest('button');if(!target)return;
 if(target.dataset.place){setPlace(target.dataset.place);return;}
 if(target.dataset.tab){tab=target.dataset.tab;search='';activityCategory='all';render();return;}
 if(target.dataset.building){building=target.dataset.building;renderContent();return;}
 if(target.dataset.event){eventDetail(Number(target.dataset.event));return;}
 if(target.dataset.photo!==undefined){const photo=albumItems()[Number(target.dataset.photo)];if(photo)showModal(places[place].name+' · 图片查看',`<img src="${photo.src}" alt="${escapeHtml(photo.name)}"><p class="small">${escapeHtml(photo.name)}</p><span class="badge">${photo.reference?'项目参考素材 · 非相册已保存图片':'仅当前页面预览 · 未保存到项目'}</span>`);return;}
 if(actions[target.dataset.action])actions[target.dataset.action]();
});
document.addEventListener('input',event=>{if(event.target.id==='content-search'){search=event.target.value.trim();if(tab==='clubs')updateClubResults();else updateEventResults();}});
document.addEventListener('change',event=>{
 const id=event.target.id;
 if(id==='preview-state'){mode=event.target.value;if($('#modal').open)closeModal();renderContent();}
 else if(id==='category-filter'){activityCategory=event.target.value;tab==='clubs'?updateClubResults():updateEventResults();}
 else if(id==='campus-filter'){activityCampus=event.target.value;updateEventResults();}
 else if(id==='date-filter'){activityDate=event.target.value;updateEventResults();}
});
document.addEventListener('submit',event=>{if(event.target.id==='course-preview-form'){event.preventDefault();const course=new FormData(event.target).get('course');showModal('保存反馈 · 状态示意',`<span class="badge green">成功状态示意</span><p>“${escapeHtml(course)}”的表单填写完成。</p><div class="info-box">此处展示操作结束后的提示样式；本预览没有将课程写入浏览器数据库。</div>`);}});
$('#photo-input').addEventListener('change',async(event)=>{
 const file=event.target.files[0];if(!file)return;
 const targetPlace=event.target.dataset.place;
 if(!file.type.startsWith('image/')){toast('无法预览：请选择有效的图片文件。');return;}
 if(file.size>15*1024*1024){toast('为避免预览卡顿，此页面暂限 15 MB；正式上传限制尚待确认。');return;}
 try{
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('read'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
  await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=data;});
  albums[places[targetPlace].id].push({src:data,name:file.name,reference:false});
  if(place===targetPlace&&tab==='album'){mode='demo';$('#preview-state').value=mode;renderContent();}
  toast(`图片已加入${places[targetPlace].name}的临时预览；刷新后清空，尚未保存到项目。`);
 }catch{toast('无法读取这张图片，请换一个文件。现有预览图片不受影响。');}
});
function returnCampus(){if($('#modal').open){closeModal();return;}$('#panel').hidden=true;$('#campus-return').hidden=false;$('.pause').innerHTML='<i class="status-dot"></i>校园场景预览';$('.campus-choices button').focus();}
$('#return-campus').addEventListener('click',returnCampus);
$('#modal-close').addEventListener('click',closeModal);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#modal').open&&!$('#panel').hidden){event.preventDefault();returnCampus();}});
fillIcons();render();
