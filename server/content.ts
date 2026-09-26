/**
 * 公共内容校验（docs/03 第 3.2、6 节）。纯函数，服务端保存前整体校验。
 * 不接受未知字段；编辑内容为纯文字；链接只接受 http/https；时间为带时区的 RFC 3339 且开始早于结束；
 * ID 唯一；活动的主办社团必须存在于同一快照。
 */

import type { CampusId, PublicContent } from '../src/shared/contracts.ts';
import { ApiFailure } from './errors.ts';

const CAMPUS_IDS: readonly CampusId[] = ['yuelushan', 'lunan', 'xiaoxiang'];
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

type FieldError = { path: string; message: string };

function exactKeys(value: unknown, keys: readonly string[], path: string, errors: FieldError[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push({ path, message: '必须是对象' });
    return false;
  }
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push({ path: `${path}.${key}`, message: '不支持的字段' });
  return true;
}

function text(value: unknown, path: string, errors: FieldError[], required = true) {
  if (typeof value !== 'string') errors.push({ path, message: '必须是文字' });
  else if (required && value.trim() === '') errors.push({ path, message: '不能为空' });
}

function links(value: unknown, path: string, errors: FieldError[]) {
  if (!Array.isArray(value)) return void errors.push({ path, message: '必须是列表' });
  value.forEach((link, i) => {
    const at = `${path}[${i}]`;
    if (!exactKeys(link, ['label', 'url'], at, errors)) return;
    text(link.label, `${at}.label`, errors);
    try {
      const url = new URL(String(link.url));
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch {
      errors.push({ path: `${at}.url`, message: '必须是 http 或 https 链接' });
    }
  });
}

export function validatePublicContent(content: unknown): asserts content is PublicContent {
  const errors: FieldError[] = [];
  if (!exactKeys(content, ['clubs', 'activities'], 'content', errors)) throw invalid(errors);
  const { clubs, activities } = content;
  if (!Array.isArray(clubs)) errors.push({ path: 'clubs', message: '必须是列表' });
  if (!Array.isArray(activities)) errors.push({ path: 'activities', message: '必须是列表' });
  if (errors.length) throw invalid(errors);

  const clubIds = new Set<string>();
  (clubs as unknown[]).forEach((club, i) => {
    const at = `clubs[${i}]`;
    if (!exactKeys(club, ['id', 'name', 'category', 'summary', 'campusIds', 'links'], at, errors)) return;
    text(club.id, `${at}.id`, errors);
    if (typeof club.id === 'string') {
      if (clubIds.has(club.id)) errors.push({ path: `${at}.id`, message: '社团 ID 重复' });
      clubIds.add(club.id);
    }
    text(club.name, `${at}.name`, errors);
    text(club.category, `${at}.category`, errors);
    text(club.summary, `${at}.summary`, errors, false);
    if (!Array.isArray(club.campusIds) || club.campusIds.some((c) => !CAMPUS_IDS.includes(c as CampusId))) {
      errors.push({ path: `${at}.campusIds`, message: '校区只能是 yuelushan、lunan、xiaoxiang' });
    }
    links(club.links, `${at}.links`, errors);
  });

  const activityIds = new Set<string>();
  (activities as unknown[]).forEach((activity, i) => {
    const at = `activities[${i}]`;
    const keys = ['id', 'name', 'organizerClubId', 'category', 'startsAt', 'endsAt', 'campusId', 'venue', 'description', 'links'];
    if (!exactKeys(activity, keys, at, errors)) return;
    text(activity.id, `${at}.id`, errors);
    if (typeof activity.id === 'string') {
      if (activityIds.has(activity.id)) errors.push({ path: `${at}.id`, message: '活动 ID 重复' });
      activityIds.add(activity.id);
    }
    text(activity.name, `${at}.name`, errors);
    text(activity.category, `${at}.category`, errors);
    text(activity.venue, `${at}.venue`, errors);
    text(activity.description, `${at}.description`, errors, false);
    if (typeof activity.organizerClubId !== 'string' || !clubIds.has(activity.organizerClubId)) {
      errors.push({ path: `${at}.organizerClubId`, message: '主办社团不存在' });
    }
    if (activity.campusId !== null && !CAMPUS_IDS.includes(activity.campusId as CampusId)) {
      errors.push({ path: `${at}.campusId`, message: '校区只能是三个校区之一或 null' });
    }
    const starts = typeof activity.startsAt === 'string' && RFC3339.test(activity.startsAt) ? Date.parse(activity.startsAt) : NaN;
    const ends = typeof activity.endsAt === 'string' && RFC3339.test(activity.endsAt) ? Date.parse(activity.endsAt) : NaN;
    if (Number.isNaN(starts)) errors.push({ path: `${at}.startsAt`, message: '须为带时区的 RFC 3339 时间' });
    if (Number.isNaN(ends)) errors.push({ path: `${at}.endsAt`, message: '须为带时区的 RFC 3339 时间' });
    if (!Number.isNaN(starts) && !Number.isNaN(ends) && starts >= ends) {
      errors.push({ path: `${at}.endsAt`, message: '结束时间必须晚于开始时间' });
    }
    links(activity.links, `${at}.links`, errors);
  });

  if (errors.length) throw invalid(errors);
}

function invalid(fields: FieldError[]) {
  return new ApiFailure(422, 'INVALID_CONTENT', '公共内容未通过校验，请按字段提示修正。', fields);
}
