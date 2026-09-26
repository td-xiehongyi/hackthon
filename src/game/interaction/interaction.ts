/**
 * 地点互动判定（docs/02 第 3.3、5.1、5.2 节）。纯逻辑，无 Phaser 依赖。
 *
 * - 只有 verificationStatus 为 verified、且 entrancePoint 与 triggerPolygon 均已标定、
 *   且 placeId 在注册表中的记录才可提供进入提示；pending 或坐标缺失时不提示。
 * - 按角色**脚底点**是否处于 triggerPolygon 判定，不要求整个碰撞体进入，也不要求踩中入口点。
 * - 多个范围重叠时，选距 entrancePoint 最近者；同距按 placeId 字典序。提示与打开使用同一结果。
 * - 只有一次**新的** E 按下才发请求：忽略自动重复、输入框内按键和暂停期间的按键。
 *   按住 E 走入范围不会打开——判定只发生在 keydown 那一刻。
 */

import type {
  CollisionArea,
  InteractionRecord,
  PlaceId,
  PlaceSession,
  Point,
  Polygon,
  SafePoint,
} from '@/shared/contracts';
import { isPlaceId } from '@/shared/place-registry';
import { pointInPolygon, polygonProblems, segmentsIntersect } from '../movement/geometry';
import { footprintFits, type Footprint, type WalkableWorld } from '../movement/movement';

/** 已可用于正式提示的互动记录（坐标齐全、已核验、地点已注册）。 */
export interface ActiveInteraction {
  placeId: PlaceId;
  entrancePoint: Point;
  triggerPolygon: Polygon;
}

export function activeInteractions(records: readonly InteractionRecord[]): ActiveInteraction[] {
  const result: ActiveInteraction[] = [];
  for (const record of records) {
    if (record.verificationStatus !== 'verified') continue;
    if (!record.entrancePoint || !record.triggerPolygon) continue;
    if (!isPlaceId(record.placeId)) continue;
    result.push({ placeId: record.placeId, entrancePoint: record.entrancePoint, triggerPolygon: record.triggerPolygon });
  }
  return result;
}

/** 当前互动目标：脚底点所在的有效范围中，距入口参考点最近者；同距按 placeId 排序。 */
export function selectTarget(foot: Point, interactions: readonly ActiveInteraction[]): PlaceId | null {
  let best: { placeId: PlaceId; distance: number } | null = null;
  for (const item of interactions) {
    if (!pointInPolygon(foot, item.triggerPolygon)) continue;
    const distance = Math.hypot(foot.x - item.entrancePoint.x, foot.y - item.entrancePoint.y);
    if (
      !best ||
      distance < best.distance - 1e-9 ||
      (Math.abs(distance - best.distance) <= 1e-9 && item.placeId < best.placeId)
    ) {
      best = { placeId: item.placeId, distance };
    }
  }
  return best?.placeId ?? null;
}

export interface InteractKeyEvent {
  /** 浏览器 KeyboardEvent.repeat：长按产生的自动重复事件。 */
  repeat: boolean;
  /** 焦点是否在输入框等可编辑元素中。 */
  editable: boolean;
}

/** 这一次 E 键按下是否应请求打开功能页。返回目标地点或 null。 */
export function interactRequest(
  event: InteractKeyEvent,
  suspended: boolean,
  target: PlaceId | null,
): PlaceId | null {
  if (event.repeat || event.editable || suspended) return null;
  return target;
}

/* ------------------------------------------------------------------ */
/* 返回校园时的落点                                                    */
/* ------------------------------------------------------------------ */

export type ReturnResolution =
  | { kind: 'original'; position: Point }
  | { kind: 'fallback'; position: Point; safePointId: string }
  | { kind: 'error'; message: string };

/**
 * 优先恢复按 E 时的原触发位置；原位置因地图变化已不能容纳脚底碰撞体时，
 * 使用该地点已核验、用途含 return 且可站立的兜底点；都不可用时报错，不送到 (0,0) 或任意地标。
 */
export function resolveReturnPosition(
  session: Pick<PlaceSession, 'placeId' | 'entryPosition'>,
  records: readonly InteractionRecord[],
  safePoints: readonly SafePoint[],
  world: WalkableWorld,
  footprint: Footprint,
): ReturnResolution {
  if (footprintFits(session.entryPosition, footprint, world)) {
    return { kind: 'original', position: { ...session.entryPosition } };
  }
  const record = records.find((r) => r.placeId === session.placeId);
  const fallbackId = record?.returnFallbackPointId ?? null;
  const safePoint = fallbackId ? safePoints.find((p) => p.id === fallbackId) : undefined;
  if (
    safePoint &&
    safePoint.verificationStatus === 'verified' &&
    safePoint.usage.includes('return') &&
    footprintFits(safePoint.position, footprint, world)
  ) {
    return { kind: 'fallback', position: { ...safePoint.position }, safePointId: safePoint.id };
  }
  return { kind: 'error', message: '原触发位置已失效，且没有可用的返回兜底点；角色保持暂停。' };
}

/* ------------------------------------------------------------------ */
/* 标注检查                                                            */
/* ------------------------------------------------------------------ */

function pointStrictlyInside(p: Point, poly: Polygon): boolean {
  if (!pointInPolygon(p, poly)) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(p, p, poly[j]!, poly[i]!)) return false; // 在边界上
  }
  return true;
}

function centroid(poly: Polygon): Point {
  return {
    x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
    y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
  };
}

function properCross(a: Point, b: Point, c: Point, d: Point) {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * 两个多边形是否有正面积重叠（仅边界接触不算）。
 * 检查边的真正交叉、顶点严格在内、重心严格在内；对本项目的凸多边形与常见凹多边形足够。
 */
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  for (let i = 0, k = a.length - 1; i < a.length; k = i++) {
    for (let j = 0, l = b.length - 1; j < b.length; l = j++) {
      if (properCross(a[k]!, a[i]!, b[l]!, b[j]!)) return true;
    }
  }
  if (a.some((p) => pointStrictlyInside(p, b)) || b.some((p) => pointStrictlyInside(p, a))) return true;
  return pointStrictlyInside(centroid(a), b) || pointStrictlyInside(centroid(b), a);
}

/** 检查一条已核验互动记录：几何合法、未覆盖障碍、引用的兜底点存在且用途正确。 */
export function interactionProblems(
  record: InteractionRecord,
  collisions: readonly CollisionArea[],
  safePoints: readonly SafePoint[],
): string[] {
  const problems: string[] = [];
  if (!isPlaceId(record.placeId)) problems.push(`未注册的地点 ID：${record.placeId}`);
  if (record.verificationStatus !== 'verified') return problems;
  if (!record.entrancePoint || !record.triggerPolygon) {
    problems.push(`${record.placeId} 标为 verified 但入口或触发范围为空`);
    return problems;
  }
  const kinds = polygonProblems(record.triggerPolygon);
  if (kinds.length) problems.push(`${record.placeId} 触发范围不合法：${kinds.join(', ')}`);
  for (const c of collisions) {
    if (polygonsOverlap(record.triggerPolygon, c.polygon)) {
      problems.push(`${record.placeId} 触发范围覆盖了不可通行区域 ${c.id}`);
    }
  }
  if (record.returnFallbackPointId) {
    const sp = safePoints.find((p) => p.id === record.returnFallbackPointId);
    if (!sp) problems.push(`${record.placeId} 引用的兜底点不存在：${record.returnFallbackPointId}`);
    else if (!sp.usage.includes('return')) problems.push(`${record.placeId} 的兜底点用途不含 return`);
  }
  return problems;
}
