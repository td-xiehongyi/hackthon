import { describe, expect, test } from 'vitest';
import type { Point } from '@/shared/contracts';
import {
  pointInPolygon,
  polygonProblems,
  rectInsidePolygon,
  rectOverlapsPolygon,
  rectToPolygon,
} from '@/game/movement/geometry';
import {
  chooseFacing,
  DEV_TUNING,
  footprintFits,
  inputVector,
  NO_INPUT,
  step,
  type CharacterState,
  type MoveInput,
  type WalkableWorld,
} from '@/game/movement/movement';
import {
  PLAYGROUND_COLLISION,
  PLAYGROUND_OCCLUDERS,
  PLAYGROUND_RECTS,
  PLAYGROUND_SIZE,
  PLAYGROUND_SPAWN,
  PLAYGROUND_WALKABLE,
} from '@/game/dev/playground-world';

const world: WalkableWorld = { walkableAreas: PLAYGROUND_WALKABLE, collisionAreas: PLAYGROUND_COLLISION };
const input = (keys: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...keys });
const at = (position: Point, extra: Partial<CharacterState> = {}): CharacterState => ({
  position, facing: 'down', mode: 'walk', moving: false, ...extra,
});

/** 连续推进若干秒（固定 1/60 帧）。 */
function run(state: CharacterState, keys: Partial<MoveInput>, seconds: number) {
  let s = state;
  for (let t = 0; t < seconds; t += 1 / 60) s = step(s, input(keys), 1 / 60, world);
  return s;
}

describe('几何', () => {
  const square = rectToPolygon({ x: 0, y: 0, width: 10, height: 10 });
  const lShape = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
  ];

  test('点在多边形内、边界上、外部', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 10, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 7, y: 7 }, lShape)).toBe(false);
  });

  test('矩形完全在凹多边形内的判定不被凹口欺骗', () => {
    expect(rectInsidePolygon({ x: 1, y: 1, width: 2, height: 2 }, lShape)).toBe(true);
    expect(rectInsidePolygon({ x: 2, y: 2, width: 6, height: 6 }, lShape)).toBe(false);
    // U 形：凹口从顶边伸入。矩形四角都在 U 形内，但凹口从中间穿过矩形。
    const uShape = [
      { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 6 }, { x: 7, y: 6 },
      { x: 7, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const rect = { x: 1, y: 1, width: 8, height: 8 };
    for (const corner of [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 9 }, { x: 1, y: 9 }]) {
      expect(pointInPolygon(corner, uShape)).toBe(true);
    }
    expect(rectInsidePolygon(rect, uShape)).toBe(false);
  });

  test('矩形与多边形重叠：仅边界接触不算重叠', () => {
    expect(rectOverlapsPolygon({ x: 10, y: 0, width: 5, height: 5 }, square)).toBe(false);
    expect(rectOverlapsPolygon({ x: 9, y: 0, width: 5, height: 5 }, square)).toBe(true);
    // 细长矩形横穿多边形，四角都不在内。
    expect(rectOverlapsPolygon({ x: -5, y: 4, width: 20, height: 2 }, square)).toBe(true);
  });

  test('多边形合法性：顶点不足、重复、非有限、自交', () => {
    expect(polygonProblems(square)).toEqual([]);
    expect(polygonProblems([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toContain('too-few-vertices');
    expect(polygonProblems([...square, { x: 0, y: 0 }])).toContain('duplicate-vertex');
    expect(polygonProblems([{ x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 2, y: 0 }])).toContain('non-finite');
    const bowtie = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    expect(polygonProblems(bowtie)).toContain('self-intersecting');
  });
});

describe('朝向与方向向量（docs/04 第 4 节）', () => {
  test('取绝对值较大的轴；相等时取水平；停止时保留上次朝向', () => {
    expect(chooseFacing(1, 0.5, 'up')).toBe('right');
    expect(chooseFacing(-0.2, 0.9, 'up')).toBe('down');
    expect(chooseFacing(0, -1, 'down')).toBe('up');
    expect(chooseFacing(-1, -1, 'down')).toBe('left');
    expect(chooseFacing(1, 1, 'up')).toBe('right');
    expect(chooseFacing(0, 0, 'left')).toBe('left');
  });

  test('斜向速度归一化，相反按键互相抵消', () => {
    const d = inputVector(input({ right: true, down: true }));
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(inputVector(input({ left: true, right: true }))).toEqual({ x: 0, y: 0 });
  });
});

describe('测试场景数据本身合法', () => {
  test('多边形合法、出生点可站立、遮挡物在场景内', () => {
    for (const area of [...PLAYGROUND_WALKABLE, ...PLAYGROUND_COLLISION]) {
      expect(polygonProblems(area.polygon), area.id).toEqual([]);
    }
    expect(footprintFits(PLAYGROUND_SPAWN, DEV_TUNING.walkFootprint, world)).toBe(true);
    expect(footprintFits(PLAYGROUND_SPAWN, DEV_TUNING.rideFootprint, world)).toBe(true);
    for (const o of PLAYGROUND_OCCLUDERS) {
      expect(o.rect.x + o.rect.width).toBeLessThanOrEqual(PLAYGROUND_SIZE.width);
      expect(o.depthAnchorY).toBeGreaterThan(o.rect.y);
    }
  });
});

describe('脚底碰撞体可通行判定', () => {
  test('没有行走区时任何位置都不可站立（不默认开放整张图）', () => {
    expect(footprintFits(PLAYGROUND_SPAWN, DEV_TUNING.walkFootprint, { walkableAreas: [], collisionAreas: [] })).toBe(false);
  });

  test('脚底中心在行走区内但碰撞体一角压到建筑，判为不可站立', () => {
    const b = PLAYGROUND_RECTS.building;
    // 脚底中心在建筑右侧 3 像素处，宽 8 的碰撞体左缘会压进建筑。
    expect(footprintFits({ x: b.x + b.width + 3, y: b.y + 20 }, DEV_TUNING.walkFootprint, world)).toBe(false);
    expect(footprintFits({ x: b.x + b.width + 5, y: b.y + 20 }, DEV_TUNING.walkFootprint, world)).toBe(true);
  });

  test('跨越相邻行走区接缝（广场→窄巷、广场→桥）可以站立', () => {
    const lane = PLAYGROUND_RECTS.lane;
    expect(footprintFits({ x: lane.x + 5, y: lane.y + 2 }, DEV_TUNING.walkFootprint, world)).toBe(true);
    const bridge = PLAYGROUND_RECTS.bridge;
    expect(footprintFits({ x: bridge.x, y: bridge.y + 12 }, DEV_TUNING.walkFootprint, world)).toBe(true);
  });
});

describe('移动与碰撞', () => {
  test('WASD 移动改变位置并更新朝向', () => {
    const s = run(at(PLAYGROUND_SPAWN), { right: true }, 0.5);
    expect(s.position.x).toBeGreaterThan(PLAYGROUND_SPAWN.x + 20);
    expect(s.position.y).toBe(PLAYGROUND_SPAWN.y);
    expect(s.facing).toBe('right');
    expect(s.moving).toBe(true);
  });

  test('停下后保留朝向，moving 为 false', () => {
    const s = step(at(PLAYGROUND_SPAWN, { facing: 'left' }), NO_INPUT, 1 / 60, world);
    expect(s.facing).toBe('left');
    expect(s.moving).toBe(false);
    expect(s.position).toEqual(PLAYGROUND_SPAWN);
  });

  test('不能穿越建筑；顶墙时仍朝向按键方向', () => {
    const b = PLAYGROUND_RECTS.building;
    const start = { x: b.x + b.width / 2, y: b.y + b.height + 30 };
    const s = run(at(start), { up: true }, 3);
    // 碰撞体顶边停在建筑底边外侧。
    expect(s.position.y - DEV_TUNING.walkFootprint.height).toBeGreaterThanOrEqual(b.y + b.height - 1e-6);
    expect(s.facing).toBe('up');
  });

  test('斜向顶墙时沿墙滑动', () => {
    const b = PLAYGROUND_RECTS.building;
    const start = { x: b.x + 10, y: b.y + b.height + 6 };
    const s = run(at(start), { up: true, right: true }, 1.5);
    expect(s.position.x).toBeGreaterThan(start.x + 30);
  });

  test('骑行比步行快', () => {
    const walk = run(at(PLAYGROUND_SPAWN), { right: true }, 0.5);
    const ride = run(at(PLAYGROUND_SPAWN), { right: true, ride: true }, 0.5);
    expect(ride.mode).toBe('ride');
    expect(ride.position.x - PLAYGROUND_SPAWN.x).toBeGreaterThan((walk.position.x - PLAYGROUND_SPAWN.x) * 1.5);
  });

  test('松开 Shift 立即恢复步行', () => {
    const riding = run(at(PLAYGROUND_SPAWN), { right: true, ride: true }, 0.2);
    expect(riding.mode).toBe('ride');
    expect(step(riding, input({ right: true }), 1 / 60, world).mode).toBe('walk');
  });

  test('窄巷可骑行进入，巷内切换骑行保持位置，横向仍不能穿墙', () => {
    const lane = PLAYGROUND_RECTS.lane;
    const entry = { x: lane.x + lane.width / 2, y: lane.y - 10 };
    const walked = run(at(entry), { down: true }, 2);
    expect(walked.position.y).toBeGreaterThan(lane.y + 60);
    const tryRide = step(walked, input({ ride: true }), 1 / 60, world);
    expect(tryRide.mode).toBe('ride');
    expect(tryRide.position).toEqual(walked.position);
    expect(footprintFits(tryRide.position, DEV_TUNING.rideFootprint, world)).toBe(true);
    const rode = run(at(entry), { down: true, ride: true }, 2);
    expect(rode.position.y).toBeGreaterThan(lane.y + 60);
    expect(rode.mode).toBe('ride');
    const sideways = run(at({ x: entry.x, y: lane.y + 50 }), { right: true, ride: true }, 1);
    expect(sideways.position.x + DEV_TUNING.rideFootprint.width / 2).toBeLessThanOrEqual(lane.x + lane.width);
  });

  test('桥面可走通到东岸，桥外水面阻挡（步行与骑行）', () => {
    const bridge = PLAYGROUND_RECTS.bridge;
    const start = { x: bridge.x - 20, y: bridge.y + bridge.height / 2 + 2 };
    for (const ride of [false, true]) {
      const crossed = run(at(start), { right: true, ride }, 3);
      expect(crossed.position.x, `ride=${ride}`).toBeGreaterThan(PLAYGROUND_RECTS.eastBank.x + 10);
    }
    // 在桥上向南走，不能下到水面。
    const onBridge = { x: bridge.x + 40, y: bridge.y + 12 };
    const south = run(at(onBridge), { down: true, ride: true }, 2);
    expect(south.position.y).toBeLessThanOrEqual(bridge.y + bridge.height + 1e-6);
  });

  test('高速大步长（卡顿帧）也不会穿透 10 像素宽的障碍', () => {
    const thinWorld: WalkableWorld = {
      walkableAreas: [{ id: 'w', polygon: rectToPolygon({ x: 0, y: 0, width: 200, height: 40 }) }],
      collisionAreas: [{ id: 'wall', reason: 'thin', polygon: rectToPolygon({ x: 100, y: 0, width: 10, height: 40 }) }],
    };
    const fast = { ...DEV_TUNING, rideSpeed: 5000 };
    const s = step(at({ x: 50, y: 20 }), input({ right: true, ride: true }), 1, thinWorld, fast);
    expect(s.position.x + DEV_TUNING.rideFootprint.width / 2).toBeLessThanOrEqual(100 + 1e-6);
  });
});

describe('遮挡物与树干', () => {
  test('树干底部阻挡，树冠不阻挡：可以从树后（树冠下方区域）走过', () => {
    const trunk = PLAYGROUND_RECTS.treeTrunk;
    // 从树干正南方向北走，被树干挡住。
    const blocked = run(at({ x: trunk.x + trunk.width / 2, y: trunk.y + 30 }), { up: true }, 2);
    expect(blocked.position.y).toBeGreaterThanOrEqual(trunk.y + trunk.height + DEV_TUNING.walkFootprint.height - 1e-6);
    // 在树冠覆盖的高度（树干上方）横向穿过树，不被阻挡。
    const behind = run(at({ x: trunk.x - 30, y: trunk.y - 10 }), { right: true }, 1.5);
    expect(behind.position.x).toBeGreaterThan(trunk.x + trunk.width + 20);
  });
});
