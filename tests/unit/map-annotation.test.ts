import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  MAP_HEIGHT_PX,
  MAP_ID,
  MAP_IMAGE_PATH,
  MAP_IMAGE_SHA256,
  MAP_WIDTH_PX,
  type MapAnnotation,
  type Point,
} from '@/shared/contracts';
import { polygonProblems } from '@/game/movement/geometry';
import {
  DEV_TUNING,
  footprintFits,
  nearestStandable,
  rasterizeWorld,
  step,
  NO_INPUT,
  type CharacterState,
  type Footprint,
  type WalkableWorld,
} from '@/game/movement/movement';
import { activeInteractions } from '@/game/interaction/interaction';

const annotation: MapAnnotation = JSON.parse(
  readFileSync(`public${MAP_IMAGE_PATH.replace(/\.png$/, '.annotations.json')}`, 'utf-8'),
);
const polygons: WalkableWorld = { walkableAreas: annotation.walkableAreas, collisionAreas: annotation.collisionAreas };
const world = rasterizeWorld(polygons, MAP_WIDTH_PX, MAP_HEIGHT_PX);

/** 按像素步长做连通搜索：从 start 出发，脚底碰撞体能到达哪些整像素位置。 */
function reachable(start: Point, fp: Footprint) {
  const W = MAP_WIDTH_PX, H = MAP_HEIGHT_PX;
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  const s = Math.round(start.y) * W + Math.round(start.x);
  seen[s] = 1; queue[tail++] = s;
  while (head < tail) {
    const p = queue[head++]!;
    const x = p % W, y = (p / W) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (seen[q] || !footprintFits({ x: nx, y: ny }, fp, world)) continue;
      seen[q] = 1; queue[tail++] = q;
    }
  }
  return (p: Point) => seen[Math.round(p.y) * W + Math.round(p.x)] === 1;
}

/**
 * 关键位置（原图像素）。只用于检查连通性，不是地点入口或安全点，不写入标注。
 * 取自 v20 底图上对应地标旁的步道/道路。
 */
const KEY_SPOTS: Record<string, Point> = {
  岳麓山图书馆前广场: { x: 200, y: 262 },
  岳麓山南门门洞: { x: 345, y: 390 },
  和平楼前: { x: 380, y: 250 },
  麓南二食堂南: { x: 560, y: 780 },
  潇湘体育场副场旁: { x: 349, y: 1005 },
  潇湘教学楼群前: { x: 510, y: 1362 },
  潇湘图书馆前: { x: 650, y: 1370 },
  玉带湖步行桥桥面: { x: 718, y: 1401 },
  西二环南段: { x: 250, y: 1450 },
};

describe('v20 通行标注', () => {
  test('与当前底图身份一致，且仍为待核验状态', () => {
    expect(annotation.mapId).toBe(MAP_ID);
    expect(annotation.imagePath).toBe(MAP_IMAGE_PATH);
    expect(annotation.imageSha256).toBe(MAP_IMAGE_SHA256);
    expect([annotation.widthPx, annotation.heightPx]).toEqual([MAP_WIDTH_PX, MAP_HEIGHT_PX]);
    expect(annotation.annotationStatus).toBe('pending');
    expect(annotation.geographyStatus).toBe('pending');
  });

  test('只标定了通行范围：入口、安全点、地标、楼座仍为空，不产生互动提示', () => {
    expect(activeInteractions(annotation.interactions)).toEqual([]);
    expect(annotation.safePoints).toEqual([]);
    expect(annotation.buildings).toEqual([]);
    expect(annotation.interactions.map((r) => r.placeId).sort()).toEqual([
      'xiaoxiang_library', 'xiaoxiang_sports_ground', 'xiaoxiang_teaching_group',
    ]);
  });

  test('行走区多边形合法、在图内、ID 唯一', () => {
    const ids = new Set<string>();
    for (const area of annotation.walkableAreas) {
      expect(polygonProblems(area.polygon), area.id).toEqual([]);
      for (const p of area.polygon) {
        expect(p.x >= 0 && p.x <= MAP_WIDTH_PX && p.y >= 0 && p.y <= MAP_HEIGHT_PX, area.id).toBe(true);
      }
      expect(ids.has(area.id)).toBe(false);
      ids.add(area.id);
    }
  });

  test('栅格加速与逐多边形判定结果一致', () => {
    const samples: Point[] = [];
    for (let i = 0; i < 400; i++) samples.push({ x: 20 + ((i * 73) % 1000), y: 20 + ((i * 131) % 1470) });
    const small: WalkableWorld = {
      walkableAreas: annotation.walkableAreas.filter((a) => a.polygon[0]!.y > 700 && a.polygon[0]!.y < 800),
      collisionAreas: [],
    };
    const smallRaster = rasterizeWorld(small, MAP_WIDTH_PX, MAP_HEIGHT_PX);
    for (const p of samples.filter((q) => q.y > 705 && q.y < 795)) {
      expect(footprintFits(p, DEV_TUNING.walkFootprint, smallRaster), `${p.x},${p.y}`).toBe(
        footprintFits(p, DEV_TUNING.walkFootprint, small),
      );
    }
  });

  test('水面中心、建筑内部不可站立', () => {
    for (const [name, p] of Object.entries({ 后湖: { x: 930, y: 800 }, 半月湖: { x: 590, y: 580 }, 二食堂楼内: { x: 560, y: 700 }, 体育场鸟巢草坪: { x: 370, y: 1100 } })) {
      expect(footprintFits(p, DEV_TUNING.walkFootprint, world), name).toBe(false);
    }
  });

  test('步行可从地图中心到达所有关键位置；骑行可到达除窄步道外的关键位置附近', () => {
    const start = nearestStandable({ x: 520, y: 756 }, DEV_TUNING.rideFootprint, world)!;
    expect(start).not.toBeNull();
    const walk = reachable(start, DEV_TUNING.walkFootprint);
    for (const [name, p] of Object.entries(KEY_SPOTS)) {
      const near = nearestStandable(p, DEV_TUNING.walkFootprint, world, 4);
      expect(near && walk(near), `步行到 ${name}`).toBe(true);
    }
    const ride = reachable(start, DEV_TUNING.rideFootprint);
    for (const [name, p] of Object.entries(KEY_SPOTS)) {
      const near = nearestStandable(p, DEV_TUNING.rideFootprint, world, 6);
      expect(near && ride(near), `骑行到 ${name}`).toBe(true);
    }
  }, 60_000);

  test('沿西二环向南持续骑行不会被卡住', () => {
    let s: CharacterState = { position: { x: 250, y: 950 }, facing: 'down', mode: 'walk', moving: false };
    expect(footprintFits(s.position, DEV_TUNING.rideFootprint, world)).toBe(true);
    for (let i = 0; i < 60; i++) s = step(s, { ...NO_INPUT, down: true, ride: true }, 1 / 60, world);
    expect(s.mode).toBe('ride');
    expect(s.position.y).toBeGreaterThan(950 + DEV_TUNING.rideSpeed * 0.9);
  });
});
