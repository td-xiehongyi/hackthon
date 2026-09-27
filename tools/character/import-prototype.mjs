/**
 * 把队友的角色原型（hackthon-character-playground-prototype）转换为本项目的
 * CharacterManifest（docs/04 角色素材接口）。
 *
 * 用法：node tools/character/import-prototype.mjs <原型根目录>
 *
 * 产物先写入 assets/characters/temp-prototype-blob/runtime/，再复制到
 * public/characters/temp-prototype/，**属于 A 的临时测试素材**：
 * - 不写入照片角色的正式运行目录，不计入 E 的正式交付。
 * - 原型只有 idle / walk / run，没有骑电动车造型。本转换用 run 动画临时顶替
 *   ride/move、用 idle 顶替 ride/idle，仅为验证 Shift 状态切换，不是骑行美术。
 * - 原型有 8 方向；契约只要求 up/down/left/right 四个屏幕方向，斜向帧不引用。
 *
 * 雪碧图按字节原样复制，不做任何像素改动；manifest 记录源文件 SHA-256。
 */

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('用法：node tools/character/import-prototype.mjs <原型根目录>');
  process.exit(1);
}

const sheetSrc = join(source, 'assets', 'character-sheet.png');
const meta = JSON.parse(readFileSync(join(source, 'assets', 'character-meta.json'), 'utf-8'));
const sheetBytes = readFileSync(sheetSrc);
const pngWidth = sheetBytes.readUInt32BE(16);
const pngHeight = sheetBytes.readUInt32BE(20);
if (pngWidth !== meta.sheetWidth || pngHeight !== meta.sheetHeight) {
  throw new Error(`雪碧图实际尺寸 ${pngWidth}x${pngHeight} 与原型 meta 声明不符`);
}

/**
 * 脚底落地点（帧内局部像素）。
 * 原型各帧不透明区域横向约 x=2..17，最底行在 y=19..20（身体挤压拉伸时上下浮动）。
 * 取固定锚点 (10, 20)：所有帧使用同一落地点，换帧时世界位置不漂移，
 * 身体的上下起伏作为动画本身呈现。
 */
const ANCHOR = { x: 10, y: 20 };
const FACINGS = ['up', 'down', 'left', 'right'];
/** 契约状态 → 原型动画 */
const MAPPING = {
  'walk/idle': 'idle',
  'walk/move': 'walk',
  'ride/idle': 'idle', // 临时：原型无骑行造型
  'ride/move': 'run', // 临时：以奔跑动画顶替骑行移动
};

const SHEET_ID = 'prototype-sheet';
const clips = [];
for (const [key, state] of Object.entries(MAPPING)) {
  const [mode, action] = key.split('/');
  const anim = meta.animations[state];
  for (const facing of FACINGS) {
    const origin = anim.directions[facing];
    clips.push({
      mode,
      facing,
      action,
      loop: true,
      frames: anim.frameDurationMs.map((durationMs, index) => ({
        sheetId: SHEET_ID,
        rect: {
          x: origin.x + index * meta.frameWidth,
          y: origin.y,
          width: meta.frameWidth,
          height: meta.frameHeight,
        },
        anchor: { ...ANCHOR },
        durationMs,
      })),
    });
  }
}

const manifest = {
  schemaVersion: 1,
  characterId: 'temp-prototype-blob',
  sheets: [{ id: SHEET_ID, url: 'character-sheet.png', width: pngWidth, height: pngHeight }],
  clips,
};

const outDir = resolve('assets/characters/temp-prototype-blob/runtime');
mkdirSync(outDir, { recursive: true });
copyFileSync(sheetSrc, join(outDir, 'character-sheet.png'));
writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const sha = createHash('sha256').update(sheetBytes).digest('hex');
writeFileSync(
  join(outDir, 'SOURCE.md'),
  `# 临时角色素材来源

**用途：A 的临时测试素材，不是 E 交付的正式角色，也不代表人物外观已确认。**

- 来源：队友原型 \`hackthon-character-playground-prototype\`（README 自述“占位造型，不是最终美术”），由其 \`tools/generate-sprites.js\` 代码绘制。
- 雪碧图：\`character-sheet.png\` 按字节原样复制，${pngWidth} × ${pngHeight}，RGBA，SHA-256 \`${sha}\`。
- 帧尺寸 ${meta.frameWidth} × ${meta.frameHeight}；锚点统一取帧内 (${ANCHOR.x}, ${ANCHOR.y}) 作为脚底落地点。
- 状态映射：walk/idle←idle，walk/move←walk，**ride/idle←idle、ride/move←run（原型没有电动车造型，骑行外观仅为临时顶替）**。
- 原型的 4 个斜向方向未被引用；契约只要求 up/down/left/right。
- 由 \`node tools/character/import-prototype.mjs <原型目录>\` 生成；重新生成会覆盖本目录。
`,
);

const runtimeDir = resolve('public/characters/temp-prototype');
mkdirSync(runtimeDir, { recursive: true });
for (const name of ['character-sheet.png', 'manifest.json', 'SOURCE.md']) {
  copyFileSync(join(outDir, name), join(runtimeDir, name));
}
console.log(`已写入 ${outDir} 并同步到 ${runtimeDir}：${clips.length} 个状态入口，sheet sha256=${sha}`);
