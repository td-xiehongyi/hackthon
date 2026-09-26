import type { CampusId, PlaceId, PlaceIdentity } from '../shared/contracts';

/** 启动界面与校区页共用的静态说明。坐标、入口均未标定，这里只有名称。 */
export interface CampusInfo {
  id: CampusId;
  index: string;
  name: string;
  note: string;
  intro: string;
  landmarks: string[];
  placeIds: PlaceId[];
}

export const CAMPUSES: CampusInfo[] = [
  {
    id: 'yuelushan',
    index: '01',
    name: '岳麓山校区',
    note: '南门 · 图书馆 · 和平楼 · 观云池',
    intro: '地图北侧的老校区，沿南门进入后经图书馆、和平楼到观云池。当前只提供地图浏览与地标定位。',
    landmarks: ['南门', '图书馆', '和平楼', '观云池'],
    placeIds: [],
  },
  {
    id: 'lunan',
    index: '02',
    name: '麓南校区',
    note: '升华公寓 · 半月湖 · 二食堂 · 天桥',
    intro: '地图中部的生活区，升华公寓、二食堂围绕半月湖，天桥跨过西二环连接南北。当前只提供地图浏览与地标定位。',
    landmarks: ['升华公寓', '半月湖', '二食堂', '天桥', '后湖'],
    placeIds: [],
  },
  {
    id: 'xiaoxiang',
    index: '03',
    name: '潇湘校区',
    note: '可互动：图书馆 · 教学楼群 · 体育场（副场）',
    intro: '首版唯一带功能地点的校区。靠近图书馆、教学楼群或体育场（副场）按 E 进入对应功能页；三处共用相册。',
    landmarks: ['图书馆', '教学楼群', '体育场（副场）', '体育场（鸟巢）'],
    placeIds: ['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground'],
  },
];

export function findCampus(id: CampusId): CampusInfo {
  return CAMPUSES.find((c) => c.id === id) ?? CAMPUSES[0];
}

/** 地点注册表（A 独占）。功能页由 B/C/D 提供，这里只固定身份与说明。 */
export interface PlaceInfo {
  identity: PlaceIdentity;
  summary: string;
  owner: string;
  features: string[];
}

export const PLACES: Record<PlaceId, PlaceInfo> = {
  xiaoxiang_library: {
    identity: { placeId: 'xiaoxiang_library', featureKey: 'library', name: '潇湘图书馆', campusId: 'xiaoxiang' },
    summary: '图书馆介绍、图片上传与共用相册。',
    owner: 'D',
    features: ['图书馆介绍', '图片上传 / 查看', '共用相册 PlaceGallery'],
  },
  xiaoxiang_teaching_group: {
    identity: { placeId: 'xiaoxiang_teaching_group', featureKey: 'teaching', name: '潇湘教学楼群', campusId: 'xiaoxiang' },
    summary: '个人课表：课程录入、周课表、单双周与楼座筛选。',
    owner: 'B',
    features: ['课程表单', '周课表 / 周次', '楼座筛选', 'CSV 导入导出'],
  },
  xiaoxiang_sports_ground: {
    identity: { placeId: 'xiaoxiang_sports_ground', featureKey: 'stadium', name: '体育场（副场）', campusId: 'xiaoxiang' },
    summary: '社团目录与活动查询，含本地内容编辑器。',
    owner: 'C',
    features: ['社团目录', '活动筛选 / 日期状态', '内容编辑器'],
  },
};
