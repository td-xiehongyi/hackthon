import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const dir=new URL('./',import.meta.url);
const metadata=JSON.parse(readFileSync(new URL('review-metadata.json',dir),'utf8'));
let html=readFileSync(new URL('../../photo-gray-student/e1/preview.html',dir),'utf8');
html=html.replaceAll('灰衣黑包男生','黄肚肚')
 .replace('灰衣、黑包，走进像素校园','黄肚肚，走进像素校园')
 .replace('黑色短发 · 灰色短袖 · 浅蓝长裤 · 黑色双肩包 · 领口眼镜。','金黄色梨形身体 · 奶油色圆肚皮 · 绿色眼睛 · 棕色手脚。')
 .replace('E1 外观已确认；最新动画小样见本角色 E2 目录。完整裤型、白色运动鞋、背面及蓝色电动车为设计补全；基础姿态双手放松或扶车把；角色尺寸、动画帧数和正式接入尚未确认。','当前为 E1 外观待审阅稿。背面与蓝白电动车为设计补全；站立时双手扶肚，骑行时双手扶把。尚未制作动画或接入游戏。')
 .replace('缩小后领口眼镜、五官细节会丢失','缩小后绿色眼睛、手指细节会丢失')
 .replaceAll('character-views.png','character-views-v3.png')
 .replace('当前为 E1 外观待审阅稿。','基础外观已确认；当前为肚子稍加大的 v3 修订稿。')
 .replace('尚未制作动画或接入游戏。','动画小样已在 E2 目录提供；尚未接入首页。')
 .replace('尚未制作行走帧、骑行动画及覆盖 16 状态的正式素材包。','E2 已提供行走与骑行动画候选；完整正式素材包与首页接入未完成。')
 .replace(/const frames=\[[\s\S]*?\];/,'const frames='+JSON.stringify(metadata.frames)+';')
 .replace('Number(size.value)/458','Number(size.value)/431');
writeFileSync(new URL('preview.html',dir),html);
copyFileSync(new URL('../../photo-gray-student/e1/verify-preview.mjs',dir),new URL('verify-preview.mjs',dir));
