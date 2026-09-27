/**
 * v20 颜色提取 + assets/maps/campus-v20.navigation.json 人工修正 → 通行蒙版。
 * npm run map:annotate 会重新应用修正规则，不会丢失桥、操场和建筑/水域边界。
 * 黄=原步道，蓝=原道路，绿=开放草地/树木/操场/桥，红=阻挡。
 * 边界仍待用户目视核验；入口与地理核验状态不由此工具确认。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const SOURCE = 'public/maps/campus-v20.png';
const POLICY = 'assets/maps/campus-v20.navigation.json';
const OUT_MASK = 'assets/maps/campus-v20.walkable.png';
const OUT_CHECK = 'assets/maps/campus-v20.walkable-check.png';
const MAX_FILL_HOLE = 260;
const MIN_ISLAND = 400;
const sourceBytes = readFileSync(SOURCE);
const { width: W, height: H, channels: C, data } = decodePng(sourceBytes);
const N = W * H;
const policy = JSON.parse(readFileSync(POLICY, 'utf8'));

// 换底图时必须迁移坐标；校验失败前不写任何产物。
if (policy.schemaVersion !== 1 || policy.mapId !== 'csu-campus-v20' ||
    policy.imageSha256 !== createHash('sha256').update(sourceBytes).digest('hex') ||
    policy.widthPx !== W || policy.heightPx !== H) throw new Error('通行修正规则与底图不匹配，请先迁移坐标。');
for (const key of ['roadsideClearancePx', 'buildingClearancePx']) {
  if (!Number.isInteger(policy[key]) || policy[key] < 0 || policy[key] > 64) throw new Error(`无效修正距离：${key}`);
}
const ids = new Set();
for (const key of ['allowAreas', 'buildings', 'waterAreas', 'crossings']) {
  if (!Array.isArray(policy[key])) throw new Error(`缺失修正规则：${key}`);
  for (const area of policy[key]) {
    if (!area.id || ids.has(area.id) || !area.reason || !Array.isArray(area.polygon) || area.polygon.length < 3 ||
        area.polygon.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > W || p.y < 0 || p.y > H)) {
      throw new Error(`无效修正区域：${area.id}`);
    }
    ids.add(area.id);
  }
}

const PATH = 1, ROAD = 2, GRASS = 3;
const cls = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2];
  if (r > 225 && g > 225 && b > 140 && b < 235 && Math.abs(r - g) < 20) cls[i] = PATH;
  else if (r > 135 && r < 200 && g > 155 && g < 215 && b > 200 && b - r > 25 && b - r < 85) cls[i] = ROAD;
  else if (r > 130 && g > 165 && g >= r && g - r < 110 && b < 180 && g - b > 45) cls[i] = GRASS;
}
const walk = Uint8Array.from(cls, (v) => v ? 1 : 0);

/** 四邻接连通块；用于去除孤立高光和填补小装饰孔洞。 */
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
{
  const { labels, sizes, touchesEdge } = components(walk, 0);
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    if (l >= 0 && !touchesEdge[l] && sizes[l] <= MAX_FILL_HOLE) walk[i] = 1;
  }
}
{
  const { labels, sizes } = components(walk, 1);
  for (let i = 0; i < N; i++) if (walk[i] && sizes[labels[i]] < MIN_ISLAND) walk[i] = 0;
}

/** 方形邻域扩展，两次滑动窗口；避免逐像素扫描整个邻域。 */
function expand(mask, radius) {
  const rows = new Uint8Array(N), result = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = -radius; x < W; x++) {
      if (x + radius < W) sum += mask[y * W + x + radius];
      if (x - radius - 1 >= 0) sum -= mask[y * W + x - radius - 1];
      if (x >= 0) rows[y * W + x] = sum > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -radius; y < H; y++) {
      if (y + radius < H) sum += rows[(y + radius) * W + x];
      if (y - radius - 1 >= 0) sum -= rows[(y - radius - 1) * W + x];
      if (y >= 0) result[y * W + x] = sum > 0 ? 1 : 0;
    }
  }
  return result;
}
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function paint(mask, area, value) {
  const xs = area.polygon.map((p) => p.x), ys = area.polygon.map((p) => p.y);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++) {
      if (inPoly(x + 0.5, y + 0.5, area.polygon)) mask[y * W + x] = value;
    }
  }
}

// 路旁树木与建筑周围树木放行；仅以清理后的道路/步道作为邻域种子，草地不继续扩张。
const roadSeeds = Uint8Array.from(cls, (v, i) => walk[i] && (v === PATH || v === ROAD) ? 1 : 0);
const buildings = new Uint8Array(N);
for (const area of policy.buildings) paint(buildings, area, 1);
const roadside = expand(roadSeeds, policy.roadsideClearancePx);
const nearBuildings = expand(buildings, policy.buildingClearancePx);
for (let i = 0; i < N; i++) if (roadside[i] || nearBuildings[i]) walk[i] = 1;
for (const area of policy.allowAreas) paint(walk, area, 1);

// 桥只覆盖其自身水域切口；建筑最后扣除，绝不因放宽道路而变得可穿越。
for (const area of policy.waterAreas) paint(walk, area, 0);
for (const area of policy.crossings) paint(walk, area, 1);
for (const area of policy.buildings) paint(walk, area, 0);

mkdirSync('assets/maps', { recursive: true });
const mask = Buffer.alloc(N);
for (let i = 0; i < N; i++) mask[i] = walk[i] ? 255 : 0;
writeFileSync(OUT_MASK, encodePng({ width: W, height: H, channels: 1, data: mask }));

const check = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  const tint = !walk[i] ? [200, 40, 40] : cls[i] === ROAD ? [60, 120, 255] : cls[i] === PATH ? [255, 215, 60] : [60, 205, 120];
  for (let c = 0; c < 3; c++) check[i * 3 + c] = Math.round(data[i * C + c] * 0.45 + tint[c] * 0.55);
}
writeFileSync(OUT_CHECK, encodePng({ width: W, height: H, channels: 3, data: check }));
const total = walk.reduce((s, v) => s + v, 0);
const { sizes } = components(walk, 1);
console.log(`可通行 ${(total / N * 100).toFixed(1)}%，连通块 ${sizes.length} 个，最大 ${Math.max(...sizes)} 像素`);
console.log(`已应用 ${POLICY}；已写入 ${OUT_MASK}、${OUT_CHECK}`);
