import { describe, expect, test } from 'vitest';
import type { InteractionRecord, SafePoint } from '@/shared/contracts';
import { rectToPolygon } from '@/game/movement/geometry';
import { DEV_TUNING, footprintFits, type WalkableWorld } from '@/game/movement/movement';
import {
  activeInteractions,
  interactionProblems,
  interactRequest,
  polygonsOverlap,
  resolveReturnPosition,
  selectTarget,
} from '@/game/interaction/interaction';
import {
  PLAYGROUND_COLLISION,
  PLAYGROUND_INTERACTIONS,
  PLAYGROUND_SAFE_POINTS,
  PLAYGROUND_TELEPORTS,
  PLAYGROUND_WALKABLE,
} from '@/game/dev/playground-world';
import pending from '../../docs/examples/map.pending.json';

const world: WalkableWorld = { walkableAreas: PLAYGROUND_WALKABLE, collisionAreas: PLAYGROUND_COLLISION };
const active = activeInteractions(PLAYGROUND_INTERACTIONS);
const E = { repeat: false, editable: false };

describe('只有已核验且坐标齐全的记录才提供提示', () => {
  test('正式待标定模板：三个地点都不产生互动', () => {
    expect(activeInteractions(pending.interactions as InteractionRecord[])).toEqual([]);
  });

  test('pending、坐标缺失、未注册 ID 均被排除', () => {
    const base = PLAYGROUND_INTERACTIONS[0]!;
    const records: InteractionRecord[] = [
      { ...base, verificationStatus: 'pending' },
      { ...base, triggerPolygon: null },
      { ...base, entrancePoint: null },
      { ...base, placeId: 'xiaoxiang_main_stadium' as never },
    ];
    expect(activeInteractions(records)).toEqual([]);
  });
});

describe('目标选择', () => {
  test('按脚底点判定；范围外无目标', () => {
    expect(selectTarget(PLAYGROUND_TELEPORTS.xiaoxiang_library, active)).toBe('xiaoxiang_library');
    expect(selectTarget(PLAYGROUND_TELEPORTS.outside, active)).toBeNull();
  });

  test('重叠范围选距入口参考点最近者', () => {
    // (215,160) 同时在两个范围内；距教学楼群入口 31.6，距体育场入口 41.2。
    expect(selectTarget(PLAYGROUND_TELEPORTS.overlap, active)).toBe('xiaoxiang_teaching_group');
    expect(selectTarget({ x: 225, y: 160 }, active)).toBe('xiaoxiang_sports_ground');
  });

  test('同距时按 placeId 排序，结果与输入顺序无关', () => {
    const tie = { x: 220, y: 170 }; // 距两个入口都是 35
    expect(selectTarget(tie, active)).toBe('xiaoxiang_sports_ground');
    expect(selectTarget(tie, [...active].reverse())).toBe('xiaoxiang_sports_ground');
  });
});

describe('E 键请求', () => {
  test('范围内新按下才请求；范围外不请求', () => {
    expect(interactRequest(E, false, 'xiaoxiang_library')).toBe('xiaoxiang_library');
    expect(interactRequest(E, false, null)).toBeNull();
  });

  test('自动重复、输入框内、暂停期间都不请求', () => {
    expect(interactRequest({ ...E, repeat: true }, false, 'xiaoxiang_library')).toBeNull();
    expect(interactRequest({ ...E, editable: true }, false, 'xiaoxiang_library')).toBeNull();
    expect(interactRequest(E, true, 'xiaoxiang_library')).toBeNull();
  });
});

describe('返回落点', () => {
  const session = { placeId: 'xiaoxiang_library' as const, entryPosition: PLAYGROUND_TELEPORTS.xiaoxiang_library };

  test('原触发位置可站立时恢复原位，不移动到入口参考点', () => {
    const r = resolveReturnPosition(session, PLAYGROUND_INTERACTIONS, PLAYGROUND_SAFE_POINTS, world, DEV_TUNING.walkFootprint);
    expect(r).toEqual({ kind: 'original', position: PLAYGROUND_TELEPORTS.xiaoxiang_library });
  });

  test('原位置失效时使用已核验的 return 兜底点', () => {
    const blocked: WalkableWorld = {
      ...world,
      collisionAreas: [...world.collisionAreas, { id: 'new', reason: '地图变化', polygon: rectToPolygon({ x: 80, y: 100, width: 20, height: 12 }) }],
    };
    const r = resolveReturnPosition(session, PLAYGROUND_INTERACTIONS, PLAYGROUND_SAFE_POINTS, blocked, DEV_TUNING.walkFootprint);
    expect(r).toEqual({ kind: 'fallback', position: { x: 90, y: 125 }, safePointId: 'library-return' });
  });

  test('没有有效兜底时报错，不送到 (0,0)', () => {
    const noWalk: WalkableWorld = { walkableAreas: [], collisionAreas: [] };
    const r = resolveReturnPosition(session, PLAYGROUND_INTERACTIONS, PLAYGROUND_SAFE_POINTS, noWalk, DEV_TUNING.walkFootprint);
    expect(r.kind).toBe('error');
    const pendingSafe: SafePoint[] = [{ ...PLAYGROUND_SAFE_POINTS[0]!, verificationStatus: 'pending' }];
    const blocked = { ...world, collisionAreas: [...world.collisionAreas, { id: 'x', reason: 'x', polygon: rectToPolygon({ x: 80, y: 100, width: 20, height: 12 }) }] };
    expect(resolveReturnPosition(session, PLAYGROUND_INTERACTIONS, pendingSafe, blocked, DEV_TUNING.walkFootprint).kind).toBe('error');
    const teaching = { placeId: 'xiaoxiang_teaching_group' as const, entryPosition: { x: 0, y: 0 } };
    expect(resolveReturnPosition(teaching, PLAYGROUND_INTERACTIONS, PLAYGROUND_SAFE_POINTS, world, DEV_TUNING.walkFootprint).kind).toBe('error');
  });
});

describe('测试夹具自检', () => {
  test('触发范围合法、不覆盖障碍、兜底点引用正确', () => {
    for (const record of PLAYGROUND_INTERACTIONS) {
      expect(interactionProblems(record, PLAYGROUND_COLLISION, PLAYGROUND_SAFE_POINTS), record.placeId).toEqual([]);
    }
  });

  test('所有测试落点与兜底点都能容纳步行和骑行碰撞体', () => {
    for (const [name, p] of Object.entries(PLAYGROUND_TELEPORTS)) {
      expect(footprintFits(p, DEV_TUNING.walkFootprint, world), name).toBe(true);
    }
    for (const sp of PLAYGROUND_SAFE_POINTS) expect(footprintFits(sp.position, DEV_TUNING.walkFootprint, world)).toBe(true);
  });

  test('检查器能发现覆盖障碍、坏引用与空坐标', () => {
    const lib = PLAYGROUND_INTERACTIONS[0]!;
    const covering = { ...lib, triggerPolygon: rectToPolygon({ x: 50, y: 60, width: 40, height: 40 }) };
    expect(interactionProblems(covering, PLAYGROUND_COLLISION, PLAYGROUND_SAFE_POINTS).join()).toMatch(/building/);
    expect(interactionProblems({ ...lib, returnFallbackPointId: 'nope' }, PLAYGROUND_COLLISION, PLAYGROUND_SAFE_POINTS).join()).toMatch(/不存在/);
    expect(interactionProblems({ ...lib, entrancePoint: null }, PLAYGROUND_COLLISION, PLAYGROUND_SAFE_POINTS).join()).toMatch(/为空/);
  });

  test('多边形重叠判定：边界接触不算重叠', () => {
    const a = rectToPolygon({ x: 0, y: 0, width: 10, height: 10 });
    expect(polygonsOverlap(a, rectToPolygon({ x: 10, y: 0, width: 5, height: 5 }))).toBe(false);
    expect(polygonsOverlap(a, rectToPolygon({ x: 5, y: 5, width: 10, height: 10 }))).toBe(true);
    expect(polygonsOverlap(a, rectToPolygon({ x: 2, y: 2, width: 3, height: 3 }))).toBe(true);
    expect(polygonsOverlap(a, rectToPolygon({ x: -5, y: 3, width: 20, height: 2 }))).toBe(true);
  });
});
