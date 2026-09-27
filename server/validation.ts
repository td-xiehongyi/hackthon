import type { CampusId, PlaceId, PublicContent } from '../src/shared/contracts.ts';
import { ApiError } from './errors.ts';

const CAMPUS_IDS = ['yuelushan', 'lunan', 'xiaoxiang'] as const;
const PLACE_IDS = ['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground', 'lunan_canteen_2'] as const;

export function isPlaceId(value: string): value is PlaceId {
  return (PLACE_IDS as readonly string[]).includes(value);
}

export function assertPlaceId(value: string): asserts value is PlaceId {
  if (!isPlaceId(value)) {
    throw new ApiError(404, 'PLACE_NOT_FOUND', '不支持的地点');
  }
}

function isCampusId(value: unknown): value is CampusId {
  return typeof value === 'string' && (CAMPUS_IDS as readonly string[]).includes(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isRfc3339(value: string): boolean {
  if (!RFC3339_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

const LINK_KEYS = ['label', 'url'];
function isValidLinks(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((l) => {
    if (l === null || typeof l !== 'object' || Array.isArray(l)) return false;
    const rec = l as Record<string, unknown>;
    if (!Object.keys(rec).every((k) => LINK_KEYS.includes(k))) return false;
    return (
      typeof rec.label === 'string' &&
      rec.label.length > 0 &&
      typeof rec.url === 'string' &&
      isHttpUrl(rec.url)
    );
  });
}

const CLUB_KEYS = ['id', 'name', 'category', 'summary', 'campusIds', 'links'];
const ACTIVITY_KEYS = [
  'id', 'name', 'organizerClubId', 'category',
  'startsAt', 'endsAt', 'campusId', 'venue', 'description', 'links',
];

/**
 * 校验候选公共内容（社团 + 活动为同一提交单位）。
 * 校验失败抛出 422 INVALID_CONTENT，并携带 fields 定位具体字段。
 */
export function validatePublicContent(content: PublicContent): void {
  const clubs = content.clubs as unknown as Record<string, unknown>[];
  const activities = content.activities as unknown as Record<string, unknown>[];
  const fields: { path: string; message: string }[] = [];
  const clubIds = new Set<string>();

  for (let i = 0; i < clubs.length; i++) {
    const c = clubs[i];
    const base = `clubs[${i}]`;
    if (c === null || typeof c !== 'object' || Array.isArray(c)) {
      fields.push({ path: base, message: '社团须为对象' });
      continue;
    }
    for (const k of Object.keys(c)) {
      if (!CLUB_KEYS.includes(k)) fields.push({ path: `${base}.${k}`, message: '未知字段' });
    }
    if (typeof c.id !== 'string' || c.id.length === 0) fields.push({ path: `${base}.id`, message: 'id 不能为空' });
    else if (clubIds.has(c.id)) fields.push({ path: `${base}.id`, message: 'id 重复' });
    else clubIds.add(c.id);
    if (typeof c.name !== 'string' || c.name.length === 0) fields.push({ path: `${base}.name`, message: 'name 不能为空' });
    if (typeof c.category !== 'string') fields.push({ path: `${base}.category`, message: 'category 须为字符串' });
    if (typeof c.summary !== 'string') fields.push({ path: `${base}.summary`, message: 'summary 须为字符串' });
    if (!Array.isArray(c.campusIds) || !c.campusIds.every(isCampusId)) {
      fields.push({ path: `${base}.campusIds`, message: 'campusIds 含未知校区' });
    } else if (new Set(c.campusIds as CampusId[]).size !== c.campusIds.length) {
      fields.push({ path: `${base}.campusIds`, message: 'campusIds 含重复校区' });
    }
    if (!isValidLinks(c.links)) fields.push({ path: `${base}.links`, message: 'links 格式不正确' });
  }

  const activityIds = new Set<string>();
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const base = `activities[${i}]`;
    if (a === null || typeof a !== 'object' || Array.isArray(a)) {
      fields.push({ path: base, message: '活动须为对象' });
      continue;
    }
    for (const k of Object.keys(a)) {
      if (!ACTIVITY_KEYS.includes(k)) fields.push({ path: `${base}.${k}`, message: '未知字段' });
    }
    if (typeof a.id !== 'string' || a.id.length === 0) fields.push({ path: `${base}.id`, message: 'id 不能为空' });
    else if (activityIds.has(a.id)) fields.push({ path: `${base}.id`, message: 'id 重复' });
    else activityIds.add(a.id);
    if (typeof a.name !== 'string' || a.name.length === 0) fields.push({ path: `${base}.name`, message: 'name 不能为空' });
    if (typeof a.organizerClubId !== 'string' || !clubIds.has(a.organizerClubId)) {
      fields.push({ path: `${base}.organizerClubId`, message: 'organizerClubId 必须指向存在的社团' });
    }
    if (typeof a.category !== 'string') fields.push({ path: `${base}.category`, message: 'category 须为字符串' });
    if (typeof a.startsAt !== 'string' || !isRfc3339(a.startsAt)) {
      fields.push({ path: `${base}.startsAt`, message: 'startsAt 须为带时区的 RFC3339 时间' });
    }
    if (typeof a.endsAt !== 'string' || !isRfc3339(a.endsAt)) {
      fields.push({ path: `${base}.endsAt`, message: 'endsAt 须为带时区的 RFC3339 时间' });
    } else if (
      typeof a.startsAt === 'string' &&
      isRfc3339(a.startsAt) &&
      Date.parse(a.endsAt) <= Date.parse(a.startsAt)
    ) {
      fields.push({ path: `${base}.endsAt`, message: '结束时间必须晚于开始时间' });
    }
    if (a.campusId !== null && !isCampusId(a.campusId)) {
      fields.push({ path: `${base}.campusId`, message: 'campusId 须为已知校区或 null' });
    }
    if (typeof a.venue !== 'string') fields.push({ path: `${base}.venue`, message: 'venue 须为字符串' });
    if (typeof a.description !== 'string') fields.push({ path: `${base}.description`, message: 'description 须为字符串' });
    if (!isValidLinks(a.links)) fields.push({ path: `${base}.links`, message: 'links 格式不正确' });
  }

  if (fields.length > 0) {
    throw new ApiError(422, 'INVALID_CONTENT', '公共内容校验失败', fields);
  }
}

/** 依据文件头魔数识别实际图片类型，不能只相信扩展名或浏览器声明。 */
export function detectMediaType(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString('ascii');
    if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  }
  return null;
}

export function extensionFor(mediaType: string): string {
  switch (mediaType) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    default: return '.bin';
  }
}
