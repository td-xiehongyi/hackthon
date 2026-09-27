import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { MapAnnotation } from '@/shared/contracts';
import { validateAnnotation, resolveNavigation } from '@/game/map-data';

const fixture = (): MapAnnotation => JSON.parse(readFileSync('docs/examples/map.pending.json', 'utf8'));

describe('地图数据入口', () => {
  test('高亮轮廓可省略；提供时必须是图内有效多边形', () => {
    const map = fixture();
    map.interactions[0].highlightPolygon = [{ x: 1, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 10 }];
    expect(validateAnnotation(map)).toEqual([]);
    map.interactions[0].highlightPolygon[0].x = -1;
    expect(validateAnnotation(map)).toContain('建筑高亮轮廓无效');
    map.interactions[0].highlightPolygon = [];
    expect(validateAnnotation(map)).toContain('建筑高亮轮廓无效');
  });
  test('允许待标定的空模板，拒绝缺字段、错误身份和损坏几何', () => {
    expect(validateAnnotation(fixture())).toEqual([]);
    expect(validateAnnotation(null).length).toBeGreaterThan(0);
    expect(validateAnnotation({ ...fixture(), walkableAreas: null }).length).toBeGreaterThan(0);
    expect(validateAnnotation({ ...fixture(), imageSha256: 'old' }).length).toBeGreaterThan(0);
    expect(validateAnnotation({ ...fixture(), widthPx: 5 }).length).toBeGreaterThan(0);
    expect(validateAnnotation({ ...fixture(), walkableAreas: [{ id: 'bad', polygon: [{ x: NaN, y: 1 }] }] }).length).toBeGreaterThan(0);
  });
  test('verified 入口不能缺坐标，越界点不能启用', () => {
    const map = fixture();
    map.interactions[0].verificationStatus = 'verified';
    expect(validateAnnotation(map).length).toBeGreaterThan(0);
    map.interactions[0].entrancePoint = { x: -5, y: 2 };
    expect(validateAnnotation(map).length).toBeGreaterThan(0);
  });
});

describe('定位使用地图原图坐标和核验状态', () => {
  test('区分已登记但待标定和未知目标', () => {
    const map = fixture();
    expect(resolveNavigation(map, { kind: 'place', placeId: 'xiaoxiang_library' }).status).toBe('unmapped');
    expect(resolveNavigation(map, { kind: 'building', buildingId: 'missing' }).status).toBe('unknown-target');
  });
  test('已核验地点、楼座和地标得到同一原图标记；pending 不能成为标记', () => {
    const map = fixture();
    map.landmarks = [{ id: 'fixture', name: '测试地标', campusId: 'xiaoxiang', anchor: { x: 120, y: 180 }, verificationStatus: 'verified' }];
    map.buildings = [{ id: 'fixture-building', name: '测试楼座', campusId: 'xiaoxiang', groupPlaceId: 'xiaoxiang_teaching_group', aliases: [], landmarkId: 'fixture' }];
    expect(resolveNavigation(map, { kind: 'building', buildingId: 'fixture-building' })).toMatchObject({ status: 'marked', point: { x: 120, y: 180 } });
    map.landmarks[0].verificationStatus = 'pending';
    expect(resolveNavigation(map, { kind: 'landmark', landmarkId: 'fixture' }).status).toBe('unmapped');
    map.interactions[0] = { ...map.interactions[0], verificationStatus: 'verified', entrancePoint: { x: 100, y: 110 } };
    expect(resolveNavigation(map, { kind: 'place', placeId: 'xiaoxiang_library' })).toMatchObject({ status: 'marked', point: { x: 100, y: 110 } });
  });
});
