import {
  COORDINATE_SYSTEM, MAP_ID, MAP_IMAGE_PATH, MAP_IMAGE_SHA256, MAP_WIDTH_PX, MAP_HEIGHT_PX,
  type MapAnnotation, type NavigationTarget, type LocateResult, type Point,
} from '@/shared/contracts';
import { getPlace, isPlaceId } from '@/shared/place-registry';
import { polygonProblems } from './movement/geometry';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const validStatus = (v: unknown) => v === 'pending' || v === 'verified';
const validPoint = (p: unknown): p is Point => isRecord(p) && typeof p.x === 'number' && typeof p.y === 'number' &&
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= MAP_WIDTH_PX && p.y <= MAP_HEIGHT_PX;
const validPolygon = (v: unknown) => Array.isArray(v) && v.every(validPoint) && polygonProblems(v).length === 0;

/** 接收外部标注前验证；失败时场景保持只读浏览，不开放全图行走。 */
export function validateAnnotation(value: unknown): string[] {
  if (!isRecord(value)) return ['通行标注文件未能加载'];
  const errors: string[] = [];
  const fixed = { schemaVersion: 1, mapId: MAP_ID, imagePath: MAP_IMAGE_PATH, imageSha256: MAP_IMAGE_SHA256,
    widthPx: MAP_WIDTH_PX, heightPx: MAP_HEIGHT_PX, coordinateSystem: COORDINATE_SYSTEM };
  for (const [key, expected] of Object.entries(fixed)) {
    if (value[key] !== expected) errors.push(`标注 ${key} 与当前底图不匹配`);
  }
  for (const key of ['annotationStatus', 'geographyStatus']) if (!validStatus(value[key])) errors.push(`${key} 无效`);
  for (const key of ['walkableAreas', 'collisionAreas', 'landmarks', 'buildings', 'interactions', 'safePoints', 'occluders']) {
    const items = value[key];
    if (!Array.isArray(items)) { errors.push(`${key} 缺失或格式错误`); continue; }
    const ids = new Set<string>();
    for (const item of items) {
      if (!isRecord(item)) { errors.push(`${key} 记录无效`); continue; }
      const id = key === 'interactions' ? item.placeId : item.id;
      if (typeof id !== 'string' || !id || ids.has(id)) errors.push(`${key} ID 无效或重复`);
      else ids.add(id);
      if (key === 'walkableAreas' || key === 'collisionAreas') {
        if (!validPolygon(item.polygon)) errors.push(`${key} 多边形无效`);
      } else if (key === 'buildings') {
        if (typeof item.name !== 'string' || item.campusId !== 'xiaoxiang' || item.groupPlaceId !== 'xiaoxiang_teaching_group' ||
          !Array.isArray(item.aliases) || !item.aliases.every((s) => typeof s === 'string') ||
          !(item.landmarkId === null || typeof item.landmarkId === 'string')) errors.push('楼座目录无效');
      } else {
        if (!validStatus(item.verificationStatus)) errors.push(`${key} 核验状态无效`);
        if (key === 'interactions') {
          if (!isPlaceId(item.placeId)) errors.push('未登记的互动地点');
          if (item.entrancePoint !== null && !validPoint(item.entrancePoint)) errors.push('入口坐标无效');
          if (item.triggerPolygon !== null && !validPolygon(item.triggerPolygon)) errors.push('互动范围无效');
          if (item.highlightPolygon !== undefined && !validPolygon(item.highlightPolygon)) errors.push('建筑高亮轮廓无效');
          if (item.verificationStatus === 'verified' && (!item.entrancePoint || !item.triggerPolygon)) errors.push('已核验入口缺少坐标');
        }
        if (key === 'landmarks' && (typeof item.name !== 'string' || (item.anchor !== null && !validPoint(item.anchor)))) errors.push('地标无效');
        if (key === 'safePoints' && (!validPoint(item.position) || !Array.isArray(item.usage) ||
          !item.usage.every((s) => ['spawn', 'teleport', 'return'].includes(s)))) errors.push('安全点无效');
        if (key === 'occluders') {
          const r = item.rect;
          if (typeof item.imagePath !== 'string' || !item.imagePath.startsWith('/maps/') || item.imagePath.includes('..') ||
            !isRecord(r) || !validPoint(r) || typeof r.width !== 'number' || typeof r.height !== 'number' ||
            !Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0 ||
            r.x + r.width > MAP_WIDTH_PX || r.y + r.height > MAP_HEIGHT_PX ||
            typeof item.depthAnchorY !== 'number' || !Number.isFinite(item.depthAnchorY)) errors.push('遮挡素材记录无效');
        }
      }
    }
  }
  return errors;
}

export type NavigationResolution = Exclude<LocateResult, { status: 'marked' }> |
  { status: 'marked'; point: Point; label: string };

export function resolveNavigation(map: MapAnnotation | null, target: NavigationTarget): NavigationResolution {
  const unmapped = { status: 'unmapped', message: '该目标尚未完成地图标定。' } as const;
  const unknown = { status: 'unknown-target', message: '未登记的地图目标。' } as const;
  if (target.kind === 'place') {
    const place = getPlace(target.placeId);
    if (!place) return unknown;
    const record = map?.interactions.find((i) => i.placeId === target.placeId);
    return record?.verificationStatus === 'verified' && record.entrancePoint
      ? { status: 'marked', point: { ...record.entrancePoint }, label: place.name } : unmapped;
  }
  if (!map) return unknown;
  const building = target.kind === 'building' ? map.buildings.find((b) => b.id === target.buildingId) : null;
  if (target.kind === 'building' && !building) return unknown;
  const landmark = map.landmarks.find((l) => l.id === (target.kind === 'landmark' ? target.landmarkId : building?.landmarkId));
  if (!landmark) return building ? unmapped : unknown;
  return landmark.verificationStatus === 'verified' && landmark.anchor
    ? { status: 'marked', point: { ...landmark.anchor }, label: building?.name ?? landmark.name } : unmapped;
}
