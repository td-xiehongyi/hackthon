/**
 * 地点注册表。
 *
 * 地点 ID、featureKey 与显示名称在此登记；显示名称和地图位置可以修改，
 * 地点身份不随之改变。相册与课程关联一律使用 placeId，不使用名称或坐标作为键。
 *
 * 未纳入本注册表的地标（含体育场（鸟巢）及其他运动场）只能展示、搜索和定位，
 * 不提供场景功能入口或相册入口。
 */

import type { Building, PlaceId, PlaceIdentity } from './contracts';

/** 正式地图交互地点的注册条目。 */
export const PLACE_REGISTRY = [
  {
    placeId: 'xiaoxiang_library',
    featureKey: 'library',
    name: '潇湘校区图书馆',
    campusId: 'xiaoxiang',
  },
  {
    placeId: 'xiaoxiang_teaching_group',
    featureKey: 'teaching',
    name: '潇湘校区教学楼群',
    campusId: 'xiaoxiang',
  },
  {
    placeId: 'xiaoxiang_sports_ground',
    featureKey: 'stadium',
    name: '潇湘校区体育场（副场）',
    campusId: 'xiaoxiang',
  },
  {
    placeId: 'lunan_canteen_2',
    featureKey: 'canteen',
    name: '麓南校区二食堂',
    campusId: 'lunan',
  },
  {
    placeId: 'lunan_shenghua_dormitory',
    featureKey: 'dormitory',
    name: '麓南校区升华公寓',
    campusId: 'lunan',
  },
  {
    placeId: 'yuelushan_heping_hall',
    featureKey: 'heritage',
    name: '岳麓山校区和平楼',
    campusId: 'yuelushan',
  },
] as const satisfies readonly PlaceIdentity[];

export const PLACE_IDS: readonly PlaceId[] = PLACE_REGISTRY.map((place) => place.placeId);

const BY_ID = new Map<PlaceId, PlaceIdentity>(
  PLACE_REGISTRY.map((place) => [place.placeId, place as PlaceIdentity]),
);

/** 判断任意字符串是否为已注册的地点 ID。 */
export function isPlaceId(value: unknown): value is PlaceId {
  return typeof value === 'string' && BY_ID.has(value as PlaceId);
}

/** 按地点 ID 取注册条目；未注册时返回 undefined，不创建新地点。 */
export function getPlace(placeId: PlaceId): PlaceIdentity | undefined {
  return BY_ID.get(placeId);
}

/**
 * 潇湘教学楼群的楼座目录。
 *
 * 实际楼座构成与名称对应关系尚未核验（需求文档 3.5、7.2；D-12），因此这里保持空目录。
 * 教学楼模块读取到空目录时显示“未关联”状态，不得自行编造 A/B/C 座或坐标。
 * 核验结果确定后由 A 在此补齐。
 */
export const TEACHING_BUILDINGS: readonly Building[] = [];
