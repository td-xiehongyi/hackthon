/**
 * 平面几何工具：原图像素坐标，x 向右、y 向下。纯函数，无 Phaser 依赖。
 */

import type { Point, Polygon, Rect } from '@/shared/contracts';

/** 射线法判断点是否在多边形内（边界上的点视为在内）。 */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
  if (poly.length < 3) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (pointOnSegment(p, poly[j]!, poly[i]!)) return true;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function pointOnSegment(p: Point, a: Point, b: Point): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > 1e-9) return false;
  return (
    p.x >= Math.min(a.x, b.x) - 1e-9 && p.x <= Math.max(a.x, b.x) + 1e-9 &&
    p.y >= Math.min(a.y, b.y) - 1e-9 && p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

function orient(a: Point, b: Point, c: Point) {
  const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
}

/** 两条线段是否相交（含端点接触与共线重叠）。 */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && pointOnSegment(c, a, b)) ||
    (o2 === 0 && pointOnSegment(d, a, b)) ||
    (o3 === 0 && pointOnSegment(a, c, d)) ||
    (o4 === 0 && pointOnSegment(b, c, d))
  );
}

/** 两条线段是否“真正”交叉（不含端点接触、不含共线），用于判断多边形自交。 */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function rectCorners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

export function rectToPolygon(r: Rect): Polygon {
  return rectCorners(r);
}

/** 矩形（轴对齐）是否完全位于多边形内：四角在内且多边形的边不穿过矩形内部。 */
export function rectInsidePolygon(r: Rect, poly: Polygon): boolean {
  if (!rectCorners(r).every((c) => pointInPolygon(c, poly))) return false;
  // 多边形有顶点严格落在矩形内部 → 多边形有凹口伸入矩形。
  return !poly.some((v) => v.x > r.x && v.x < r.x + r.width && v.y > r.y && v.y < r.y + r.height);
}

/** 矩形与多边形是否有正面积重叠（仅边界接触不算）。 */
export function rectOverlapsPolygon(r: Rect, poly: Polygon): boolean {
  const inner = { x: r.x + 1e-6, y: r.y + 1e-6, width: r.width - 2e-6, height: r.height - 2e-6 };
  const corners = rectCorners(inner);
  if (corners.some((c) => pointInPolygon(c, poly))) return true;
  if (poly.some((v) => v.x > inner.x && v.x < inner.x + inner.width && v.y > inner.y && v.y < inner.y + inner.height)) {
    return true;
  }
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      if (segmentsIntersect(a, b, poly[k]!, poly[j]!)) return true;
    }
  }
  return false;
}

export interface PolygonProblem {
  kind: 'too-few-vertices' | 'non-finite' | 'duplicate-vertex' | 'self-intersecting';
}

/** 契约要求：至少三个不同顶点、坐标有限、不重复首顶点、不自交。 */
export function polygonProblems(poly: Polygon): PolygonProblem['kind'][] {
  const problems: PolygonProblem['kind'][] = [];
  if (poly.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) problems.push('non-finite');
  const keys = new Set(poly.map((p) => `${p.x},${p.y}`));
  if (keys.size !== poly.length) problems.push('duplicate-vertex');
  if (keys.size < 3) problems.push('too-few-vertices');
  const n = poly.length;
  outer: for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // 相邻边
      if (segmentsCross(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) {
        problems.push('self-intersecting');
        break outer;
      }
    }
  }
  return problems;
}
