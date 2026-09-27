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
import navigationPolicy from '../../assets/maps/campus-v20.navigation.json';
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
  麓南运动场草坪: { x: 725, y: 560 },
  潇湘副场草坪: { x: 360, y: 895 },
  鸟巢内部: { x: 370, y: 1100 },
  西侧草地: { x: 180, y: 1300 },
  西侧步道旁树木: { x: 160, y: 825 },
  清水路旁树木: { x: 307, y: 535 },
  图书馆旁树木: { x: 280, y: 260 },
  过街天桥: { x: 520, y: 889 },
  玉带湖东桥: { x: 885, y: 1362 },
};

describe('v20 通行标注', () => {
  test('人工修正规则绑定当前底图，所有区域多边形合法且 ID 唯一', () => {
    expect(navigationPolicy.imageSha256).toBe(MAP_IMAGE_SHA256);
    expect([navigationPolicy.widthPx, navigationPolicy.heightPx]).toEqual([MAP_WIDTH_PX, MAP_HEIGHT_PX]);
    const areas = [...navigationPolicy.allowAreas, ...navigationPolicy.buildings, ...navigationPolicy.waterAreas, ...navigationPolicy.crossings];
    expect(new Set(areas.map((a) => a.id)).size).toBe(areas.length);
    for (const area of areas) expect(polygonProblems(area.polygon), area.id).toEqual([]);
  });
  test('与当前底图身份一致，且仍为待核验状态', () => {
    expect(annotation.mapId).toBe(MAP_ID);
    expect(annotation.imagePath).toBe(MAP_IMAGE_PATH);
    expect(annotation.imageSha256).toBe(MAP_IMAGE_SHA256);
    expect([annotation.widthPx, annotation.heightPx]).toEqual([MAP_WIDTH_PX, MAP_HEIGHT_PX]);
    expect(annotation.annotationStatus).toBe('pending');
    expect(annotation.geographyStatus).toBe('pending');
  });

  test('五处地图交互可用且入口可站立；地理、安全点和楼座仍保留待核验状态', () => {
    expect(activeInteractions(annotation.interactions)).toHaveLength(5);
    for (const interaction of annotation.interactions) {
      expect(footprintFits(interaction.entrancePoint!, DEV_TUNING.rideFootprint, world), interaction.placeId).toBe(true);
      expect(polygonProblems(interaction.highlightPolygon!)).toEqual([]);
    }
    expect(annotation.safePoints).toEqual([]);
    expect(annotation.buildings).toEqual([]);
    expect(annotation.interactions.map((r) => r.placeId).sort()).toEqual([
      'lunan_canteen_2', 'lunan_shenghua_dormitory', 'xiaoxiang_library', 'xiaoxiang_sports_ground', 'xiaoxiang_teaching_group',
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
    for (const [name, p] of Object.entries({ 后湖: { x: 930, y: 800 }, 半月湖: { x: 590, y: 580 }, 二食堂楼内: { x: 560, y: 700 }, 玉带湖桥外: { x: 718, y: 1425 }, 图书馆楼内: { x: 200, y: 205 }, 体育馆楼内: { x: 485, y: 1055 } })) {
      expect(footprintFits(p, DEV_TUNING.walkFootprint, world), name).toBe(false);
    }
  });

  test('草地、操场、路边树木与桥面可站立', () => {
    for (const [name, p] of Object.entries(KEY_SPOTS)) {
      for (const fp of [DEV_TUNING.walkFootprint, DEV_TUNING.rideFootprint]) {
        expect(footprintFits(p, fp, world), name).toBe(true);
      }
    }
  });

  test('步行和骑行均可从地图中心到达草地、操场、树木区域及桥面', () => {
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
    for (const interaction of annotation.interactions) {
      expect(walk(interaction.entrancePoint!), `步行到互动区 ${interaction.placeId}`).toBe(true);
      expect(ride(interaction.entrancePoint!), `骑行到互动区 ${interaction.placeId}`).toBe(true);
    }
  }, 60_000);

  test('沿西二环向南持续骑行不会被卡住', () => {
    let s: CharacterState = { position: { x: 250, y: 950 }, facing: 'down', mode: 'walk', moving: false };
    expect(footprintFits(s.position, DEV_TUNING.rideFootprint, world)).toBe(true);
    for (let i = 0; i < 60; i++) s = step(s, { ...NO_INPUT, down: true, ride: true }, 1 / 60, world);
    expect(s.mode).toBe('ride');
    expect(s.position.y).toBeGreaterThan(950 + DEV_TUNING.rideSpeed * 0.9);
  });

  test.each([
    ['玉带湖斜桥', [{ x: 659, y: 1362 }, { x: 670, y: 1368 }, { x: 768, y: 1438 }, { x: 781, y: 1447 }]],
    ['过街天桥', [{ x: 479, y: 922 }, { x: 491, y: 913 }, { x: 554, y: 856 }, { x: 567, y: 846 }]],
    ['玉带湖东侧木桥', [{ x: 935, y: 1365 }, { x: 865, y: 1365 }]],
  ] as const)('%s 可沿桥面行进并原路返回', (_name, route) => {
    for (const ride of [false, true]) {
      let state: CharacterState = { position: { ...route[0] }, facing: 'down', mode: 'walk', moving: false };
      expect(footprintFits(state.position, DEV_TUNING.walkFootprint, world)).toBe(true);
      for (const target of [...route.slice(1), ...[...route].reverse().slice(1)]) {
        for (let frame = 0; frame < 600 && Math.hypot(target.x - state.position.x, target.y - state.position.y) > 1.5; frame++) {
          const dx = target.x - state.position.x, dy = target.y - state.position.y;
          state = step(state, { ride, left: dx < -0.7, right: dx > 0.7, up: dy < -0.7, down: dy > 0.7 }, 1 / 120, world);
          expect(state.mode).toBe(ride ? 'ride' : 'walk');
          expect(footprintFits(state.position, DEV_TUNING.walkFootprint, world)).toBe(true);
        }
        expect(Math.hypot(target.x - state.position.x, target.y - state.position.y), `ride=${ride}, target=${JSON.stringify(target)}`).toBeLessThanOrEqual(1.5);
      }
    }
  });
});
