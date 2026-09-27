import { describe, expect, test } from 'vitest';
import {
  CONTRACT_VERSION,
  MAP_HEIGHT_PX,
  MAP_ID,
  MAP_IMAGE_SHA256,
  MAP_WIDTH_PX,
  REQUEST_OPEN_PLACE_EVENT,
} from '@/shared/contracts';
import {
  isPlaceId,
  getPlace,
  PLACE_IDS,
  PLACE_REGISTRY,
  TEACHING_BUILDINGS,
} from '@/shared/place-registry';
import { parseRequestOpenPlaceDetail } from '@/app/map-bridge';

describe('共享契约固定值', () => {
  test('契约版本与地图标识与文档一致', () => {
    expect(CONTRACT_VERSION).toBe('1.0.0');
    expect(MAP_ID).toBe('csu-campus-v20');
    expect(MAP_WIDTH_PX).toBe(1041);
    expect(MAP_HEIGHT_PX).toBe(1511);
    expect(MAP_IMAGE_SHA256).toHaveLength(64);
    expect(REQUEST_OPEN_PLACE_EVENT).toBe('request-open-place');
  });
});

describe('地点注册表', () => {
  test('注册六个地点且顺序与工具链约定一致', () => {
    expect(PLACE_REGISTRY).toHaveLength(6);
    expect(PLACE_IDS).toEqual([
      'xiaoxiang_library',
      'xiaoxiang_teaching_group',
      'xiaoxiang_sports_ground',
      'lunan_canteen_2',
      'lunan_shenghua_dormitory',
      'yuelushan_heping_hall',
    ]);
  });

  test('placeId 与 featureKey 对应关系不被错配', () => {
    const pairs = PLACE_REGISTRY.map((place) => [place.placeId, place.featureKey]);
    expect(pairs).toEqual([
      ['xiaoxiang_library', 'library'],
      ['xiaoxiang_teaching_group', 'teaching'],
      ['xiaoxiang_sports_ground', 'stadium'],
      ['lunan_canteen_2', 'canteen'],
      ['lunan_shenghua_dormitory', 'dormitory'],
      ['yuelushan_heping_hall', 'heritage'],
    ]);
  });

  test('显示名称与校区归属正确', () => {
    for (const place of PLACE_REGISTRY) {
      if (place.placeId === 'yuelushan_heping_hall') {
        expect(place.campusId).toBe('yuelushan');
        expect(place.name).toBe('岳麓山校区和平楼');
        continue;
      }
      if (place.placeId === 'lunan_shenghua_dormitory') {
        expect(place.campusId).toBe('lunan');
        expect(place.name).toBe('麓南校区升华公寓');
        continue;
      }
      if (place.placeId === 'lunan_canteen_2') {
        expect(place.campusId).toBe('lunan');
        expect(place.name).toBe('麓南校区二食堂');
        continue;
      }
      expect(place.campusId).toBe('xiaoxiang');
      expect(place.name).toContain('潇湘校区');
    }
    expect(getPlace('xiaoxiang_sports_ground')?.name).toBe('潇湘校区体育场（副场）');
  });

  test('体育场入口只对应副场，不新增其他运动场 ID', () => {
    const stadiumIds = PLACE_REGISTRY.filter((place) => place.featureKey === 'stadium');
    expect(stadiumIds).toHaveLength(1);
    expect(stadiumIds[0]?.placeId).toBe('xiaoxiang_sports_ground');
    // 鸟巢及其他运动场不得成为可交互地点。
    expect(isPlaceId('xiaoxiang_main_stadium')).toBe(false);
    expect(isPlaceId('xiaoxiang_stadium_birdnest')).toBe(false);
    expect(isPlaceId('')).toBe(false);
    expect(isPlaceId(undefined)).toBe(false);
  });

  test('未注册地点查询不创建新地点', () => {
    expect(getPlace('yuelushan_library' as never)).toBeUndefined();
  });
});

describe('教学楼座目录', () => {
  test('楼座尚未核验时保持空目录，不自编 A/B/C 座', () => {
    expect(TEACHING_BUILDINGS).toEqual([]);
    expect(TEACHING_BUILDINGS).toHaveLength(0);
  });
});

describe('打开请求负载校验', () => {
  test('接受注册地点 ID', () => {
    expect(parseRequestOpenPlaceDetail({ placeId: 'lunan_canteen_2' })).toEqual({ placeId: 'lunan_canteen_2' });
    expect(parseRequestOpenPlaceDetail({ placeId: 'xiaoxiang_library' })).toEqual({
      placeId: 'xiaoxiang_library',
    });
    expect(parseRequestOpenPlaceDetail({ placeId: 'xiaoxiang_sports_ground' })).toEqual({
      placeId: 'xiaoxiang_sports_ground',
    });
  });

  test('结构不符时返回 null，不猜测地点', () => {
    expect(parseRequestOpenPlaceDetail(null)).toBeNull();
    expect(parseRequestOpenPlaceDetail('xiaoxiang_library')).toBeNull();
    expect(parseRequestOpenPlaceDetail({})).toBeNull();
    expect(parseRequestOpenPlaceDetail({ placeId: 1 })).toBeNull();
    expect(parseRequestOpenPlaceDetail({ placeId: 'yuelushan_library' })).toBeNull();
    expect(parseRequestOpenPlaceDetail({ placeId: 'xiaoxiang_stadium_birdnest' })).toBeNull();
  });
});
