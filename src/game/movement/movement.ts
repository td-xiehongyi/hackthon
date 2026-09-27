/**
 * 角色移动、脚底碰撞与朝向（docs/02 第 2、3.1 节；docs/04 第 4、5 节）。
 *
 * 纯逻辑，不依赖 Phaser，便于单元测试。所有坐标为原图像素，角色位置 = 脚底中心。
 *
 * - 有效通行范围 = 行走区并集 − 碰撞区；行走区之外默认不可通行。
 * - 完整脚底碰撞体（轴对齐矩形）必须处于有效通行范围，不能只检查中心点。
 * - 是否进入交互范围只看脚底点（在 interaction 模块中判定）。
 * - 步行与骑行使用同一有效通行范围；移动分小步推进，速度提高不会穿透窄障碍。
 */

import type {
  CollisionArea,
  Direction,
  MovementMode,
  Point,
  Polygon,
  PolygonArea,
  Rect,
} from '@/shared/contracts';
import { pointInPolygon, rectInsidePolygon, rectOverlapsPolygon } from './geometry';

/** 脚底碰撞体尺寸：以脚底中心为底边中点的矩形。 */
export interface Footprint { width: number; height: number }

export interface MovementTuning {
  walkSpeed: number; // 原图像素 / 秒
  rideSpeed: number;
  walkFootprint: Footprint;
  rideFootprint: Footprint;
}

/**
 * 开发调试参数。**不是已确认的产品参数**：
 * 移动耗时（D-02）与电动车速度倍率（D-03）仍待确认，脚底碰撞体尺寸待角色正式素材确定后由 A 复核。
 * 骑行倍率 2 仅为需求文档中记录的“此前建议”。
 */
export const DEV_TUNING: MovementTuning = {
  walkSpeed: 60,
  rideSpeed: 120,
  walkFootprint: { width: 8, height: 4 },
  // 窄路允许骑行：两种模式使用相同地面占用范围，仍检查完整碰撞体。
  rideFootprint: { width: 8, height: 4 },
};

export interface WalkableWorld {
  walkableAreas: readonly PolygonArea[];
  collisionAreas: readonly CollisionArea[];
  /**
   * 可选的像素栅格加速：grid[y * width + x] === 1 表示该像素中心可通行（已扣除碰撞区）。
   * 由 rasterizeWorld() 从同一份多边形数据生成，结果与逐多边形判定一致，只是更快。
   */
  raster?: WalkableRaster;
}

export interface WalkableRaster {
  width: number;
  height: number;
  grid: Uint8Array;
}

export function footprintRect(foot: Point, fp: Footprint): Rect {
  return { x: foot.x - fp.width / 2, y: foot.y - fp.height, width: fp.width, height: fp.height };
}

/** 采样间距（像素）。行走区之间小于该宽度的缝隙可能被视为连通。 */
const COVERAGE_STEP = 1;

function coveredByWalkable(p: Point, world: WalkableWorld) {
  return world.walkableAreas.some((area) => pointInPolygon(p, area.polygon));
}

/** 栅格判定：碰撞体覆盖到的每个像素都必须可通行；超出图片范围视为不可通行。 */
function footprintFitsRaster(r: Rect, raster: WalkableRaster): boolean {
  const x0 = Math.floor(r.x), y0 = Math.floor(r.y);
  const x1 = Math.ceil(r.x + r.width) - 1, y1 = Math.ceil(r.y + r.height) - 1;
  if (x0 < 0 || y0 < 0 || x1 >= raster.width || y1 >= raster.height) return false;
  for (let y = y0; y <= y1; y++) {
    const row = y * raster.width;
    for (let x = x0; x <= x1; x++) if (!raster.grid[row + x]) return false;
  }
  return true;
}

/**
 * 把行走区（减去碰撞区）按像素中心栅格化。适用于矩形分解后数量很多的正式标注。
 * 轴对齐矩形走快速填充，其余多边形逐像素判定。
 */
export function rasterizeWorld(world: WalkableWorld, width: number, height: number): WalkableWorld {
  const grid = new Uint8Array(width * height);
  const paint = (poly: Polygon, value: 0 | 1) => {
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const minX = Math.max(0, Math.floor(Math.min(...xs))), maxX = Math.min(width, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(height, Math.ceil(Math.max(...ys)));
    const axisRect = poly.length === 4 && new Set(xs).size === 2 && new Set(ys).size === 2;
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (axisRect || pointInPolygon({ x: x + 0.5, y: y + 0.5 }, poly)) grid[y * width + x] = value;
      }
    }
  };
  for (const area of world.walkableAreas) paint(area.polygon, 1);
  for (const area of world.collisionAreas) paint(area.polygon, 0);
  return { ...world, raster: { width, height, grid } };
}

/** 脚底碰撞体整体是否可站立。 */
export function footprintFits(foot: Point, fp: Footprint, world: WalkableWorld): boolean {
  if (world.walkableAreas.length === 0) return false; // 未标注时绝不开放整张图
  if (world.raster) return footprintFitsRaster(footprintRect(foot, fp), world.raster);
  const r = footprintRect(foot, fp);
  if (world.collisionAreas.some((c) => rectOverlapsPolygon(r, c.polygon))) return false;
  // 快速路径：完整落在单个行走区内。
  if (world.walkableAreas.some((a) => rectInsidePolygon(r, a.polygon))) return true;
  // 跨越多个相邻行走区（路口、桥头接缝）：按像素网格采样覆盖。
  const xs = sampleAxis(r.x, r.width);
  const ys = sampleAxis(r.y, r.height);
  for (const y of ys) for (const x of xs) if (!coveredByWalkable({ x, y }, world)) return false;
  return true;
}

function sampleAxis(start: number, length: number): number[] {
  const n = Math.max(1, Math.ceil(length / COVERAGE_STEP));
  return Array.from({ length: n + 1 }, (_, i) => start + (length * i) / n);
}

export interface MoveInput { up: boolean; down: boolean; left: boolean; right: boolean; ride: boolean }

export const NO_INPUT: MoveInput = { up: false, down: false, left: false, right: false, ride: false };

export interface CharacterState {
  position: Point;
  facing: Direction;
  mode: MovementMode;
  moving: boolean;
}

/**
 * 朝向规则（docs/04 第 4 节）：
 * 1. 取水平/垂直速度分量绝对值较大者所在轴的方向；
 * 2. 两轴相等且正在移动时取水平；
 * 3. 停止移动时保留上一次朝向。
 */
export function chooseFacing(vx: number, vy: number, previous: Direction): Direction {
  if (vx === 0 && vy === 0) return previous;
  if (Math.abs(vx) >= Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** 按键 → 单位方向向量；斜向归一化，使斜向速度不快于直行。 */
export function inputVector(input: MoveInput): Point {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const y = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

/**
 * 推进一帧。
 * - Shift（ride）只有在骑行碰撞体能在当前位置站立时才生效，
 *   否则保持步行，避免模式切换把角色推入障碍。
 * - 位移按不超过 1 像素的小步推进，每步分轴尝试，可沿墙滑动且不会穿透障碍。
 * - 朝向依据**输入意图**选择：顶墙时仍转向按键方向。
 */
export function step(
  state: CharacterState,
  input: MoveInput,
  dtSeconds: number,
  world: WalkableWorld,
  tuning: MovementTuning = DEV_TUNING,
): CharacterState {
  let mode: MovementMode = 'walk';
  if (input.ride && footprintFits(state.position, tuning.rideFootprint, world)) mode = 'ride';
  const fp = mode === 'ride' ? tuning.rideFootprint : tuning.walkFootprint;
  const speed = mode === 'ride' ? tuning.rideSpeed : tuning.walkSpeed;

  const dir = inputVector(input);
  const facing = chooseFacing(dir.x, dir.y, state.facing);
  const dt = Math.max(0, Math.min(dtSeconds, 0.1)); // 卡顿/切回标签页时限制单帧位移
  const dx = dir.x * speed * dt;
  const dy = dir.y * speed * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));

  let { x, y } = state.position;
  let moved = false;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps;
    if (dx !== 0 && footprintFits({ x: nx, y }, fp, world)) { x = nx; moved = true; }
    const ny = y + dy / steps;
    if (dy !== 0 && footprintFits({ x, y: ny }, fp, world)) { y = ny; moved = true; }
  }
  return { position: { x, y }, facing, mode, moving: moved };
}

/** 在 center 附近螺旋搜索第一个可站立的点（用于未标定出生点时选临时起点）。 */
export function nearestStandable(center: Point, fp: Footprint, world: WalkableWorld, maxRadius = 200): Point | null {
  if (footprintFits(center, fp, world)) return { ...center };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (const dx of Math.abs(dy) === r ? range(-r, r) : [-r, r]) {
        const p = { x: Math.round(center.x + dx), y: Math.round(center.y + dy) };
        if (footprintFits(p, fp, world)) return p;
      }
    }
  }
  return null;
}

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
