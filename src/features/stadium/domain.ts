/**
 * C 的纯领域逻辑：筛选、状态判定、时间格式化、校验、导入导出。
 * 无 React / 无副作用，可直接用 Vitest 单测，也不依赖 A/D 的交付。
 */
import type { Activity, CampusId, Club, PublicContent } from './types';

// —— 筛选 ——
export interface ClubFilter {
  keyword: string;
  category: string;
  campusId: CampusId | '';
}
export interface ActivityFilter {
  keyword: string;
  category: string;
  campusId: CampusId | '';
  /** 'YYYY-MM-DD'，空串表示不限。 */
  date: string;
}

export function filterClubs(clubs: readonly Club[], f: ClubFilter): Club[] {
  const kw = f.keyword.trim().toLowerCase();
  return clubs.filter((c) => {
    if (kw && !`${c.name} ${c.summary} ${c.category}`.toLowerCase().includes(kw)) return false;
    if (f.category && c.category !== f.category) return false;
    if (f.campusId && !c.campusIds.includes(f.campusId)) return false;
    return true;
  });
}

export function filterActivities(activities: readonly Activity[], f: ActivityFilter): Activity[] {
  const kw = f.keyword.trim().toLowerCase();
  return activities.filter((a) => {
    if (kw && !`${a.name} ${a.venue} ${a.description}`.toLowerCase().includes(kw)) return false;
    if (f.category && a.category !== f.category) return false;
    if (f.campusId && a.campusId !== f.campusId) return false;
    if (f.date && !overlapsDate(a, f.date)) return false;
    return true;
  });
}

// —— 日期（固定 Asia/Shanghai，不依赖浏览器时区） ——
function shanghaiParts(iso: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function shanghaiDateKey(iso: string): string {
  const { y, m, d } = shanghaiParts(iso);
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** 活动在 Asia/Shanghai 时区下是否覆盖 target（'YYYY-MM-DD'）。 */
function overlapsDate(a: Activity, target: string): boolean {
  const targetKey = target.replaceAll('-', '');
  return shanghaiDateKey(a.startsAt) <= targetKey && targetKey <= shanghaiDateKey(a.endsAt);
}

// —— 活动状态 ——
export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended';

export function activityStatus(a: Activity, now: Date): ActivityStatus {
  const t = now.getTime();
  if (t > new Date(a.endsAt).getTime()) return 'ended';
  if (t >= new Date(a.startsAt).getTime()) return 'ongoing';
  return 'upcoming';
}

export const STATUS_LABEL: Record<ActivityStatus, string> = {
  upcoming: '未开始',
  ongoing: '进行中',
  ended: '已结束',
};

// —— 格式化（Asia/Shanghai） ——
export function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))}`;
}

// —— 校验 ——
export interface ValidationError {
  path: string;
  message: string;
}

export function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateContent(content: PublicContent): ValidationError[] {
  const errors: ValidationError[] = [];
  const clubIds = new Set<string>();
  const activityIds = new Set<string>();
  const knownClubIds = new Set(content.clubs.map((c) => c.id));

  content.clubs.forEach((c, i) => {
    if (!c.name.trim()) errors.push({ path: `clubs[${i}].name`, message: '社团名称不能为空' });
    if (!c.id.trim()) errors.push({ path: `clubs[${i}].id`, message: '社团 ID 不能为空' });
    if (clubIds.has(c.id)) errors.push({ path: `clubs[${i}].id`, message: '社团 ID 重复' });
    clubIds.add(c.id);
    validateLinks(c.links, `clubs[${i}]`, errors);
  });

  content.activities.forEach((a, i) => {
    if (!a.name.trim()) errors.push({ path: `activities[${i}].name`, message: '活动名称不能为空' });
    if (!a.id.trim()) errors.push({ path: `activities[${i}].id`, message: '活动 ID 不能为空' });
    if (activityIds.has(a.id)) errors.push({ path: `activities[${i}].id`, message: '活动 ID 重复' });
    activityIds.add(a.id);
    if (!knownClubIds.has(a.organizerClubId)) {
      errors.push({ path: `activities[${i}].organizerClubId`, message: '主办社团不存在（请先创建或修正社团）' });
    }
    const s = new Date(a.startsAt).getTime();
    const e = new Date(a.endsAt).getTime();
    if (Number.isNaN(s)) errors.push({ path: `activities[${i}].startsAt`, message: '开始时间无效' });
    if (Number.isNaN(e)) errors.push({ path: `activities[${i}].endsAt`, message: '结束时间无效' });
    if (!Number.isNaN(s) && !Number.isNaN(e) && s >= e) {
      errors.push({ path: `activities[${i}].endsAt`, message: '开始时间必须早于结束时间' });
    }
    validateLinks(a.links, `activities[${i}]`, errors);
  });

  return errors;
}

function validateLinks(links: { label: string; url: string }[], base: string, errors: ValidationError[]): void {
  links.forEach((l, j) => {
    if (l.url && !isValidUrl(l.url)) {
      errors.push({ path: `${base}.links[${j}].url`, message: '链接必须是 http/https 地址' });
    }
  });
}

// —— 导入导出 ——
export function serializeContent(content: PublicContent): string {
  return JSON.stringify(content, null, 2);
}

export function parseContentJson(
  text: string,
): { ok: true; content: PublicContent } | { ok: false; error: string } {
  try {
    const data = JSON.parse(text) as unknown;
    if (typeof data !== 'object' || data === null) return { ok: false, error: '内容必须是 JSON 对象' };
    const obj = data as { clubs?: unknown; activities?: unknown };
    if (!Array.isArray(obj.clubs) || !Array.isArray(obj.activities)) {
      return { ok: false, error: '结构不符合：需要 clubs 和 activities 两个数组' };
    }
    return { ok: true, content: { clubs: obj.clubs as Club[], activities: obj.activities as Activity[] } };
  } catch (e) {
    return { ok: false, error: `JSON 解析失败：${(e as Error).message}` };
  }
}

// —— 工具 ——
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueCategories<T extends { category: string }>(items: readonly T[]): string[] {
  return [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
