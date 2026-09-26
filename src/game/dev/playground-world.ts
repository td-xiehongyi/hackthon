/**
 * 开发测试场景的合成世界数据。
 *
 * **临时测试夹具，不是正式地图标注。** 与 v20 底图无任何坐标对应关系，不写入
 * MapAnnotation，也不使用 csu-campus-v20 的地图 ID。仅用于在地图标定完成前验证
 * 移动、碰撞、桥面/水域、遮挡排序与坐标转换逻辑（docs/01 P1、docs/02 第 6 节末）。
 *
 * 布局（单位：测试世界像素，480 × 320）：
 *
 *   ┌──────────── 广场 ────────────┐        ┌── 东岸 ──┐
 *   │   [建筑]           [树]      │~~~~桥~~~│          │
 *   │                              │~~水域~~~│          │
 *   └───────┬──────────────────────┘        └──────────┘
 *           │窄巷（宽 10）
 *           └─ 南端
 */

import type { CollisionArea, InteractionRecord, Point, PolygonArea, Rect, SafePoint } from '@/shared/contracts';
import { rectToPolygon } from '../movement/geometry';

export const PLAYGROUND_ID = 'dev-playground' as const;
export const PLAYGROUND_SIZE = { width: 480, height: 320 } as const;

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const PLAYGROUND_RECTS = {
  plaza: r(20, 20, 260, 160),
  lane: r(60, 180, 10, 120), // 窄巷：步行与骑行碰撞体均宽 8，可通过但不能穿越侧壁
  bridge: r(280, 80, 80, 24), // 桥面：与两岸行走区相接
  eastBank: r(360, 40, 100, 200),
  building: r(60, 50, 60, 40),
  waterNorth: r(280, 20, 80, 60), // 水域拆成桥北、桥南两块，不覆盖桥面
  waterSouth: r(280, 104, 80, 136),
  treeTrunk: r(211, 96, 8, 4), // 只有树干底部阻挡；树冠不是碰撞体（docs/02 第 3.1 节）
} as const;

export const PLAYGROUND_WALKABLE: PolygonArea[] = [
  { id: 'plaza', polygon: rectToPolygon(PLAYGROUND_RECTS.plaza) },
  { id: 'lane', polygon: rectToPolygon(PLAYGROUND_RECTS.lane) },
  { id: 'bridge', polygon: rectToPolygon(PLAYGROUND_RECTS.bridge) },
  { id: 'east-bank', polygon: rectToPolygon(PLAYGROUND_RECTS.eastBank) },
];

export const PLAYGROUND_COLLISION: CollisionArea[] = [
  { id: 'building', reason: '测试建筑', polygon: rectToPolygon(PLAYGROUND_RECTS.building) },
  { id: 'water-north', reason: '测试水域（桥北）', polygon: rectToPolygon(PLAYGROUND_RECTS.waterNorth) },
  { id: 'water-south', reason: '测试水域（桥南）', polygon: rectToPolygon(PLAYGROUND_RECTS.waterSouth) },
  { id: 'tree-trunk', reason: '测试树干', polygon: rectToPolygon(PLAYGROUND_RECTS.treeTrunk) },
];

/** 遮挡物：rect 为绘制范围，depthAnchorY 为与角色脚底比较的深度基线（树干底部）。 */
export const PLAYGROUND_OCCLUDERS = [
  { id: 'tree', rect: r(200, 50, 30, 50), depthAnchorY: 100 },
] as const;

export const PLAYGROUND_SPAWN: Point = { x: 150, y: 130 };

/**
 * 临时互动范围（测试夹具，**不是三个地点的真实入口**）。
 *
 * 只借用三个固定 placeId 以便走通“进入范围 → 按 E → 功能页 → 返回原位”，
 * 坐标与 v20 校园地图无关。verified 仅表示“本测试夹具内几何已自检”，不代表地理或标注核验。
 *
 * - 图书馆：建筑南侧的一块地面（建筑本身不可通行，触发范围不覆盖建筑）。
 * - 教学楼群、体育场（副场）：广场东南部两块**有意重叠**的范围，用于验证重叠时的目标选择。
 */
export const PLAYGROUND_TRIGGER_RECTS = {
  library: r(56, 90, 68, 26),
  teaching: r(170, 130, 60, 44),
  stadium: r(210, 130, 60, 44),
} as const;

export const PLAYGROUND_INTERACTIONS: InteractionRecord[] = [
  {
    placeId: 'xiaoxiang_library',
    verificationStatus: 'verified',
    entrancePoint: { x: 90, y: 94 },
    triggerPolygon: rectToPolygon(PLAYGROUND_TRIGGER_RECTS.library),
    returnFallbackPointId: 'library-return',
  },
  {
    placeId: 'xiaoxiang_teaching_group',
    verificationStatus: 'verified',
    entrancePoint: { x: 185, y: 170 },
    triggerPolygon: rectToPolygon(PLAYGROUND_TRIGGER_RECTS.teaching),
    returnFallbackPointId: null,
  },
  {
    placeId: 'xiaoxiang_sports_ground',
    verificationStatus: 'verified',
    entrancePoint: { x: 255, y: 170 },
    triggerPolygon: rectToPolygon(PLAYGROUND_TRIGGER_RECTS.stadium),
    returnFallbackPointId: null,
  },
];

export const PLAYGROUND_SAFE_POINTS: SafePoint[] = [
  { id: 'library-return', position: { x: 90, y: 125 }, usage: ['return'], verificationStatus: 'verified' },
];

/** 开发面板“瞬移到范围内”按钮使用的测试落点：各自只落在一个范围内。 */
export const PLAYGROUND_TELEPORTS = {
  xiaoxiang_library: { x: 90, y: 108 },
  xiaoxiang_teaching_group: { x: 185, y: 160 },
  xiaoxiang_sports_ground: { x: 255, y: 160 },
  overlap: { x: 215, y: 160 }, // 两个范围都覆盖，距教学楼群入口更近
  outside: { x: 150, y: 60 },
} as const;
