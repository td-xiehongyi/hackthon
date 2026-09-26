/**
 * 从 v20 底图按颜色自动提取可通行蒙版（A 的标注辅助工具）。
 *
 * 用法：node tools/map/extract-walkable.mjs
 * 产物：
 *   assets/maps/campus-v20.walkable.png   灰度蒙版，255 = 可通行
 *   assets/maps/campus-v20.walkable-check.png  叠加检查图（黄=步道，蓝=公路，红=阻挡）
 *
 * 规则（全部基于像素颜色，不凭目测坐标）：
 * 1. 浅黄步道/广场、蓝灰公路判为可通行；草地、树、建筑、水面、跑道、标牌判为阻挡。
 * 2. 被可通行像素完全包围、面积很小的阻挡块（路上的行人、车辆、标线、斑马线、小灌木）补为可通行。
 * 3. 面积过小的孤立可通行碎片（树冠高光、建筑浅色墙面）去除。
 * 4. 颜色无法识别、但画面上明显连续的通道（桥面、校门门洞、被树根压窄的步道），
 *    按 BRIDGES 中手工给出的多边形补为可通行。每条都记录原因，便于逐条核对。
 *
 * 这是自动提取的**待核验**结果：可能把个别浅色墙面误判为可通行，或把树荫下的步道误判为阻挡。
 * 用户核对叠加检查图后，才可把标注状态改为 verified。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const SOURCE = 'public/maps/campus-v20.png';
const OUT_MASK = 'assets/maps/campus-v20.walkable.png';
const OUT_CHECK = 'assets/maps/campus-v20.walkable-check.png';

/** 被可通行区域包围、面积不超过该值的阻挡块视为路面上的小物件，补为可通行。 */
export const MAX_FILL_HOLE = 260;
/** 面积小于该值的孤立可通行碎片去除。 */
export const MIN_ISLAND = 400;

/** 手工桥面多边形（原图像素）：颜色不是步道色，但属于步行通道。 */
export const BRIDGES = [
  {
    id: 'yudai-lake-bridge',
    reason: '玉带湖步行桥桥面',
    // 沿桥面中线 (668,1366)→(768,1436) 两端各伸入岸边步道，宽 14 像素。
    polygon: [
      { x: 672, y: 1360 }, { x: 664, y: 1372 },
      { x: 764, y: 1442 }, { x: 772, y: 1430 },
    ],
  },
  {
    id: 'south-gate-arch',
    reason: '岳麓山校区南门门洞：门柱之间的通道被门楼顶部遮住，颜色无法识别',
    polygon: [
      { x: 332, y: 358 }, { x: 357, y: 358 },
      { x: 357, y: 412 }, { x: 332, y: 412 },
    ],
  },
  {
    id: 'yuelu-library-forecourt-west',
    reason: '岳麓山校区图书馆前广场向西接西侧道路的步道，边缘被樱花树压窄',
    polygon: [
      { x: 104, y: 256 }, { x: 150, y: 256 },
      { x: 150, y: 266 }, { x: 104, y: 266 },
    ],
  },
  {
    id: 'west-ring-sw-path-junction',
    reason: '西二环西侧林间步道与路缘人行道交汇处被树根压窄，不足以容纳脚底碰撞体',
    polygon: [
      { x: 196, y: 1188 }, { x: 230, y: 1188 },
      { x: 230, y: 1200 }, { x: 196, y: 1200 },
    ],
  },
];

const img = decodePng(readFileSync(SOURCE));
const { width: W, height: H, channels: C, data } = img;
const N = W * H;

const PATH = 1, ROAD = 2;
const cls = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
  if (r > 225 && g > 225 && b > 140 && b < 235 && Math.abs(r - g) < 20) cls[i] = PATH;
  else if (r > 135 && r < 200 && g > 155 && g < 215 && b > 200 && b - r > 25 && b - r < 85) cls[i] = ROAD;
}

let walk = new Uint8Array(N);
for (let i = 0; i < N; i++) walk[i] = cls[i] ? 1 : 0;

/** 4 邻接连通块标记，对 mask[i] === value 的像素。返回 { labels, sizes, touchesEdge }。 */
function components(mask, value) {
  const labels = new Int32Array(N).fill(-1);
  const sizes = [], touchesEdge = [];
  const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (mask[s] !== value || labels[s] !== -1) continue;
    const id = sizes.length;
    let top = 0, size = 0, edge = false;
    stack[top++] = s; labels[s] = id;
    while (top) {
      const p = stack[--top]; size++;
      const x = p % W, y = (p / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of nb) if (q >= 0 && mask[q] === value && labels[q] === -1) { labels[q] = id; stack[top++] = q; }
    }
    sizes.push(size); touchesEdge.push(edge);
  }
  return { labels, sizes, touchesEdge };
}

// 2. 填补被包围的小阻挡块。
{
  const { labels, sizes, touchesEdge } = components(walk, 0);
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l >= 0 && !touchesEdge[l] && sizes[l] <= MAX_FILL_HOLE) walk[i] = 1;
  }
}
// 3. 去除孤立小碎片。
{
  const { labels, sizes } = components(walk, 1);
  for (let i = 0; i < N; i++) if (walk[i] && sizes[labels[i]] < MIN_ISLAND) walk[i] = 0;
}
// 4. 桥面。
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
for (const bridge of BRIDGES) {
  const xs = bridge.polygon.map((p) => p.x), ys = bridge.polygon.map((p) => p.y);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (inPoly(x + 0.5, y + 0.5, bridge.polygon)) walk[y * W + x] = 1;
    }
  }
}

mkdirSync('assets/maps', { recursive: true });
const mask = Buffer.alloc(N);
for (let i = 0; i < N; i++) mask[i] = walk[i] ? 255 : 0;
writeFileSync(OUT_MASK, encodePng({ width: W, height: H, channels: 1, data: mask }));

const check = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
  let tint;
  if (!walk[i]) tint = [200, 40, 40];
  else if (cls[i] === ROAD) tint = [60, 120, 255];
  else tint = [255, 215, 60];
  const k = 0.55;
  check[i * 3] = Math.round(r * (1 - k) + tint[0] * k);
  check[i * 3 + 1] = Math.round(g * (1 - k) + tint[1] * k);
  check[i * 3 + 2] = Math.round(b * (1 - k) + tint[2] * k);
}
writeFileSync(OUT_CHECK, encodePng({ width: W, height: H, channels: 3, data: check }));

const total = walk.reduce((s, v) => s + v, 0);
const { sizes } = components(walk, 1);
console.log(`可通行 ${(total / N * 100).toFixed(1)}%，连通块 ${sizes.length} 个，最大 ${Math.max(...sizes)} 像素`);
console.log(`已写入 ${OUT_MASK}、${OUT_CHECK}`);
