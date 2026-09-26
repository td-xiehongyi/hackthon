/**
 * 可通行蒙版 → MapAnnotation（契约唯一消费格式）。
 *
 * 用法：node tools/map/build-annotation.mjs
 * 输入：assets/maps/campus-v20.walkable.png（由 extract-walkable.mjs 生成）
 * 输出：public/maps/campus-v20.annotations.json
 *
 * 行走区用贪心矩形分解表示（每个矩形转为四点多边形），恰好覆盖蒙版中的可通行像素；
 * 蒙版已排除建筑、水面等，因此 collisionAreas 为空。
 * annotationStatus 保持 pending：自动提取叠加通行修正后仍需核对边界；已有 geographyStatus 保留。
 * 三个互动入口、地标、楼座、安全点仍未标定，保持空值。
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from './png.mjs';

const MAP = 'public/maps/campus-v20.png';
const MASK = 'assets/maps/campus-v20.walkable.png';
const OUT = 'public/maps/campus-v20.annotations.json';

const mapBytes = readFileSync(MAP);
const mask = decodePng(readFileSync(MASK));
const { width: W, height: H } = mask;
if (W !== mapBytes.readUInt32BE(16) || H !== mapBytes.readUInt32BE(20)) throw new Error('蒙版尺寸与底图不一致');

const walk = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) walk[i] = mask.data[i * mask.channels] > 127 ? 1 : 0;

// 贪心矩形分解：自上而下、自左而右找未覆盖像素，先向右延伸，再整行向下延伸。
const used = new Uint8Array(W * H);
const rects = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!walk[i] || used[i]) continue;
    let x1 = x;
    while (x1 < W && walk[y * W + x1] && !used[y * W + x1]) x1++;
    let y1 = y + 1;
    grow: while (y1 < H) {
      for (let k = x; k < x1; k++) if (!walk[y1 * W + k] || used[y1 * W + k]) break grow;
      y1++;
    }
    for (let yy = y; yy < y1; yy++) used.fill(1, yy * W + x, yy * W + x1);
    rects.push([x, y, x1 - x, y1 - y]);
  }
}

const annotation = {
  schemaVersion: 1,
  mapId: 'csu-campus-v20',
  imagePath: '/maps/campus-v20.png',
  imageSha256: createHash('sha256').update(mapBytes).digest('hex'),
  widthPx: W,
  heightPx: H,
  coordinateSystem: 'image-pixels-top-left',
  annotationStatus: 'pending',
  geographyStatus: 'pending',
  walkableAreas: rects.map(([x, y, w, h], n) => ({
    id: `auto-${n}`,
    polygon: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
  })),
  collisionAreas: [],
  landmarks: [],
  buildings: [],
  interactions: ['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground'].map((placeId) => ({
    placeId,
    verificationStatus: 'pending',
    entrancePoint: null,
    triggerPolygon: null,
    returnFallbackPointId: null,
  })),
  safePoints: [],
  occluders: [],
};

// 重新提取通行范围不能静默清空后续录入的入口、楼座或遮挡。
if (existsSync(OUT)) {
  const previous = JSON.parse(readFileSync(OUT, 'utf8'));
  if (previous.imageSha256 !== annotation.imageSha256 || previous.mapId !== annotation.mapId) {
    throw new Error('现有标注与底图不一致，请先人工迁移坐标；原标注未覆盖。');
  }
  for (const key of ['collisionAreas', 'landmarks', 'buildings', 'interactions', 'safePoints', 'occluders']) {
    if (!Array.isArray(previous[key])) throw new Error(`现有标注 ${key} 损坏；原标注未覆盖。`);
    annotation[key] = previous[key];
  }
  annotation.geographyStatus = previous.geographyStatus;
}

// 紧凑输出：每个行走区一行，便于 diff。
const lines = JSON.stringify({ ...annotation, walkableAreas: '__AREAS__' }, null, 2).split('\n');
const areas = annotation.walkableAreas.map((a) => `    ${JSON.stringify(a)}`).join(',\n');
const text = lines.join('\n').replace('"__AREAS__"', `[\n${areas}\n  ]`);
writeFileSync(OUT, `${text}\n`);
console.log(`行走区矩形 ${rects.length} 个，写入 ${OUT}（${(Buffer.byteLength(text) / 1024).toFixed(0)} KB）`);
