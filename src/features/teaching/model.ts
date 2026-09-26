/**
 * Teaching schedule domain model.
 *
 * Personal courses and the community pool intentionally use different storage
 * keys. A failed community request can therefore never clear or overwrite the
 * current browser's personal timetable.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WeekParity = 'all' | 'odd' | 'even' | 'custom';

export type CourseSource = 'manual' | 'csv' | 'community';

export interface TimeSlot {
  period: number;
  label: string;
  /** Clock times are optional until the school publishes a verified timetable. */
  startTime: string | null;
  endTime: string | null;
}

export interface Course {
  id: string;
  name: string;
  teacher: string;
  weekday: Weekday;
  startPeriod: number;
  endPeriod: number;
  /** Explicit weeks are the source of truth; parity is a display/filter hint. */
  weeks: number[];
  weekParity: WeekParity;
  weekExpression: string;
  location: string;
  /** Stable map building id when one can be verified. */
  buildingId: string | null;
  /** Preserves an imported building label even when no map id can be matched. */
  buildingName: string;
  tags: string[];
  notes: string;
  color: string | null;
  source: CourseSource;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDraft {
  id?: string;
  name: string;
  teacher?: string;
  weekday: Weekday | number | string;
  startPeriod: number | string;
  endPeriod?: number | string;
  weeks?: readonly number[];
  weekExpression?: string;
  weekParity?: WeekParity;
  location?: string;
  buildingId?: string | null;
  buildingName?: string;
  tags?: readonly string[] | string;
  notes?: string;
  color?: string | null;
  source?: CourseSource;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuildingReference {
  id: string;
  name?: string;
  aliases?: readonly string[];
}

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  /** One-based CSV row number, including the header row. */
  row: number;
  column?: string;
  code: string;
  message: string;
  value?: string;
}

export interface ImportPreview {
  status: 'ready' | 'invalid';
  courses: Course[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  issues: ImportIssue[];
  headers: string[];
  totalRows: number;
  acceptedRows: number;
}

export interface ParseScheduleCsvOptions {
  maxWeek?: number;
  maxPeriod?: number;
  buildings?: readonly BuildingReference[];
  existingCourses?: readonly Course[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CourseStorageOptions {
  storage?: StorageLike | null;
  key?: string;
}

export interface LoadCoursesResult {
  status: 'loaded' | 'empty' | 'unavailable' | 'error';
  courses: Course[];
  issues: string[];
  message?: string;
}

export interface SaveCoursesResult {
  status: 'saved' | 'unavailable' | 'error';
  courses: Course[];
  savedAt?: string;
  message?: string;
}

export interface CommunityUser {
  id: string;
  name: string;
  interests: string[];
}

export interface CommunityCourse extends Course {
  ownerId: string;
  ownerName: string;
  ownerInterests: string[];
  sharedAt: string;
}

export interface CommunitySyncOptions {
  userId?: string;
  userName?: string;
  interests?: readonly string[];
  /** Optional HTTP endpoint. With no endpoint, the module remains local-only. */
  endpoint?: string | null;
  storage?: StorageLike | null;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export interface CommunityLoadOptions {
  endpoint?: string | null;
  storage?: StorageLike | null;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export type CommunityRemoteStatus =
  | 'synced'
  | 'not-configured'
  | 'unavailable'
  | 'error';

export interface CommunitySyncResult {
  status: 'synced' | 'local-only' | 'unavailable' | 'error';
  remoteStatus: CommunityRemoteStatus;
  userId: string;
  cached: boolean;
  sharedCourseCount: number;
  message: string;
}

export interface CommunityLoadResult {
  status: 'loaded' | 'empty' | 'unavailable' | 'error';
  remoteStatus: CommunityRemoteStatus;
  source: 'remote' | 'cache' | 'none';
  courses: CommunityCourse[];
  message: string;
}

export interface AggregatedCommunityCourse extends Course {
  ownerIds: string[];
  ownerNames: string[];
  ownerCount: number;
  ownerInterests: string[];
}

export interface FreePeriod {
  weekday: Weekday;
  startPeriod: number;
  endPeriod: number;
}

export interface SitInFilter {
  week: number;
  weekday?: Weekday;
  interests?: readonly string[];
  buildingIds?: readonly string[];
  query?: string;
  /** Defaults to true: only return classes that do not overlap personal courses. */
  onlyWhenFree?: boolean;
  currentUserId?: string;
}

export interface SitInSuggestion extends AggregatedCommunityCourse {
  matchedInterests: string[];
  conflictsWithPersonalSchedule: boolean;
  score: number;
}

interface PersonalStorageEnvelope {
  schemaVersion: 1;
  savedAt: string;
  courses: Course[];
}

interface CommunityScheduleRecord {
  user: CommunityUser;
  courses: Course[];
  updatedAt: string;
}

interface CommunityStorageEnvelope {
  schemaVersion: 1;
  savedAt: string;
  schedules: CommunityScheduleRecord[];
}

export const SCHEDULE_STORAGE_KEY = 'csu-pixel-campus:schedule:v1';
export const COMMUNITY_STORAGE_KEY = 'csu-pixel-campus:community-schedules:v1';
export const COMMUNITY_USER_ID_KEY = 'csu-pixel-campus:community-user-id:v1';
export const DEFAULT_MAX_WEEK = 20;
export const DEFAULT_MAX_PERIOD = 12;

export const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = Object.freeze({
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
});

export const DEFAULT_TIME_SLOTS: readonly TimeSlot[] = Object.freeze(
  Array.from({ length: DEFAULT_MAX_PERIOD }, (_, index) => ({
    period: index + 1,
    label: `第${index + 1}节`,
    startTime: null,
    endTime: null,
  })),
);

const PERSONAL_SCHEMA_VERSION = 1 as const;
const COMMUNITY_SCHEMA_VERSION = 1 as const;

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s_\-—–()（）【】\[\]]+/g, '');

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeForMatch(trimmed);
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
};

const sortUniqueNumbers = (values: readonly number[]): number[] =>
  [...new Set(values.filter(Number.isInteger))].sort((a, b) => a - b);

const makeId = (prefix = 'course'): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const nowIso = (): string => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const isWeekday = (value: number): value is Weekday => value >= 1 && value <= 7;

export function parseWeekday(value: unknown): Weekday | null {
  const numeric = asInteger(value);
  if (numeric !== null && isWeekday(numeric)) return numeric;

  const normalized = normalizeForMatch(normalizeText(value))
    .replace(/^星期/, '')
    .replace(/^周/, '');
  const weekdayMap: Record<string, Weekday> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
    sun: 7,
    sunday: 7,
  };
  return weekdayMap[normalized] ?? null;
}

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);

export function inferWeekParity(weeks: readonly number[]): WeekParity {
  const normalized = sortUniqueNumbers(weeks);
  if (normalized.length === 0) return 'custom';
  if (normalized.every((week) => week % 2 === 1)) return 'odd';
  if (normalized.every((week) => week % 2 === 0)) return 'even';
  const consecutive = normalized.every(
    (week, index) => index === 0 || week === normalized[index - 1] + 1,
  );
  return consecutive ? 'all' : 'custom';
}

const compressNumberRanges = (values: readonly number[]): string => {
  const sorted = sortUniqueNumbers(values);
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < sorted.length) {
    const start = sorted[cursor];
    let end = start;
    while (cursor + 1 < sorted.length && sorted[cursor + 1] === end + 1) {
      cursor += 1;
      end = sorted[cursor];
    }
    parts.push(start === end ? String(start) : `${start}-${end}`);
    cursor += 1;
  }
  return parts.join(',');
};

export function formatWeekExpression(weeks: readonly number[]): string {
  const normalized = sortUniqueNumbers(weeks);
  if (normalized.length === 0) return '';
  const parity = inferWeekParity(normalized);
  if (parity === 'odd' || parity === 'even') {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const isParitySequence = normalized.every(
      (week, index) => index === 0 || week === normalized[index - 1] + 2,
    );
    if (isParitySequence) {
      return `${first}-${last}周(${parity === 'odd' ? '单' : '双'})`;
    }
  }
  return `${compressNumberRanges(normalized)}周`;
}

export interface ParsedWeekExpression {
  weeks: number[];
  parity: WeekParity;
  label: string;
}

/** Parses WakeUp-style values such as `1-16周`, `1-16周(单)` or `1,3,5周`. */
export function parseWeekExpression(
  expression: string,
  maxWeek = DEFAULT_MAX_WEEK,
): ParsedWeekExpression {
  const normalizedMaxWeek = Math.max(1, Math.trunc(maxWeek));
  const original = expression.normalize('NFKC').trim();
  if (!original) {
    const weeks = range(1, normalizedMaxWeek);
    return { weeks, parity: 'all', label: formatWeekExpression(weeks) };
  }

  const compact = original.replace(/\s+/g, '');
  const segments = compact.split(/[,，、;；]+/).filter(Boolean);
  let weeks: number[] = [];

  for (const segment of segments) {
    if (/^(?:全周|每周|全部周|all)$/i.test(segment)) {
      weeks.push(...range(1, normalizedMaxWeek));
      continue;
    }

    const hasOdd =
      /(?:单周|单数周|\(单\)|odd)/i.test(segment) || /(?:\d|周)单$/.test(segment);
    const hasEven =
      /(?:双周|双数周|\(双\)|even)/i.test(segment) || /(?:\d|周)双$/.test(segment);
    if (hasOdd && hasEven) throw new Error(`同一段周次不能同时标记单周和双周：${segment}`);

    const tokens = segment.match(/\d+(?:[-~～—–至到]\d+)?/g) ?? [];
    const remainder = segment
      .replace(/\d+(?:[-~～—–至到]\d+)?/g, '')
      .replace(/(?:第|周次|周|单数|双数|单|双|odd|even|[()])/gi, '');
    if (remainder) throw new Error(`无法识别周次片段：${segment}`);

    const segmentWeeks: number[] = [];
    if (tokens.length === 0) {
      if (!hasOdd && !hasEven) throw new Error(`无法识别周次：${expression}`);
      segmentWeeks.push(...range(1, normalizedMaxWeek));
    } else {
      for (const token of tokens) {
        const bounds = token.split(/[-~～—–至到]/).map((item) => Number.parseInt(item, 10));
        const start = bounds[0];
        const end = bounds[1] ?? start;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
          throw new Error(`无效周次范围：${token}`);
        }
        if (end > normalizedMaxWeek) {
          throw new Error(`周次 ${end} 超出本学期上限 ${normalizedMaxWeek}`);
        }
        segmentWeeks.push(...range(start, end));
      }
    }
    weeks.push(...segmentWeeks.filter((week) => hasOdd ? week % 2 === 1 : hasEven ? week % 2 === 0 : true));
  }

  weeks = sortUniqueNumbers(weeks);
  if (weeks.length === 0) throw new Error(`周次结果为空：${expression}`);

  const parity = inferWeekParity(weeks);
  return { weeks, parity, label: formatWeekExpression(weeks) };
}

const normalizeTags = (value: CourseDraft['tags'] | unknown): string[] => {
  if (Array.isArray(value)) {
    return uniqueStrings(value.filter((item): item is string => typeof item === 'string'));
  }
  if (typeof value !== 'string') return [];
  return uniqueStrings(value.split(/[|;；、,/]+/));
};

export function createCourse(
  draft: CourseDraft,
  options: { maxWeek?: number; maxPeriod?: number } = {},
): Course {
  const maxWeek = Math.max(1, Math.trunc(options.maxWeek ?? DEFAULT_MAX_WEEK));
  const maxPeriod = Math.max(1, Math.trunc(options.maxPeriod ?? DEFAULT_MAX_PERIOD));
  const name = normalizeText(draft.name);
  if (!name) throw new Error('课程名称不能为空');

  const weekday = parseWeekday(draft.weekday);
  if (weekday === null) throw new Error(`无法识别星期：${String(draft.weekday)}`);

  const startPeriod = asInteger(draft.startPeriod);
  const endPeriod = asInteger(draft.endPeriod ?? draft.startPeriod);
  if (startPeriod === null || endPeriod === null) throw new Error('节次必须是整数');
  if (startPeriod < 1 || endPeriod < startPeriod || endPeriod > maxPeriod) {
    throw new Error(`节次应在 1-${maxPeriod} 之间，且结束节次不能早于开始节次`);
  }

  let parsedWeeks: ParsedWeekExpression;
  if (draft.weeks !== undefined) {
    const weeks = sortUniqueNumbers([...draft.weeks]);
    if (weeks.length === 0 || weeks.some((week) => week < 1 || week > maxWeek)) {
      throw new Error(`周次应在 1-${maxWeek} 之间`);
    }
    let parity = draft.weekParity ?? inferWeekParity(weeks);
    if (parity === 'odd') {
      if (weeks.some((week) => week % 2 === 0)) throw new Error('单周课程不能包含双数周');
    } else if (parity === 'even') {
      if (weeks.some((week) => week % 2 === 1)) throw new Error('双周课程不能包含单数周');
    } else {
      parity = inferWeekParity(weeks);
    }
    parsedWeeks = { weeks, parity, label: formatWeekExpression(weeks) };
  } else {
    parsedWeeks = parseWeekExpression(draft.weekExpression ?? '', maxWeek);
    if (draft.weekParity === 'odd' || draft.weekParity === 'even') {
      const remainder = draft.weekParity === 'odd' ? 1 : 0;
      parsedWeeks.weeks = parsedWeeks.weeks.filter((week) => week % 2 === remainder);
      parsedWeeks.parity = draft.weekParity;
      parsedWeeks.label = formatWeekExpression(parsedWeeks.weeks);
      if (parsedWeeks.weeks.length === 0) throw new Error('单双周筛选后没有有效周次');
    }
  }

  const timestamp = nowIso();
  return {
    id: normalizeText(draft.id) || makeId(),
    name,
    teacher: normalizeText(draft.teacher),
    weekday,
    startPeriod,
    endPeriod,
    weeks: parsedWeeks.weeks,
    weekParity: parsedWeeks.parity,
    weekExpression: parsedWeeks.label,
    location: normalizeText(draft.location),
    buildingId: normalizeText(draft.buildingId) || null,
    buildingName: normalizeText(draft.buildingName),
    tags: normalizeTags(draft.tags),
    notes: normalizeText(draft.notes),
    color: normalizeText(draft.color) || null,
    source: draft.source ?? 'manual',
    createdAt: normalizeText(draft.createdAt) || timestamp,
    updatedAt: normalizeText(draft.updatedAt) || timestamp,
  };
}

const courseFromUnknown = (value: unknown): Course => {
  if (!isRecord(value)) throw new Error('课程记录不是对象');
  const sourceValue = normalizeText(value.source);
  const source: CourseSource =
    sourceValue === 'csv' || sourceValue === 'community' ? sourceValue : 'manual';
  const weekParityValue = normalizeText(value.weekParity);
  const weekParity: WeekParity | undefined =
    weekParityValue === 'odd' ||
    weekParityValue === 'even' ||
    weekParityValue === 'all' ||
    weekParityValue === 'custom'
      ? weekParityValue
      : undefined;
  return createCourse({
    id: normalizeText(value.id),
    name: normalizeText(value.name),
    teacher: normalizeText(value.teacher),
    weekday: typeof value.weekday === 'number' || typeof value.weekday === 'string' ? value.weekday : '',
    startPeriod:
      typeof value.startPeriod === 'number' || typeof value.startPeriod === 'string'
        ? value.startPeriod
        : '',
    endPeriod:
      typeof value.endPeriod === 'number' || typeof value.endPeriod === 'string'
        ? value.endPeriod
        : undefined,
    weeks: Array.isArray(value.weeks)
      ? value.weeks.filter((item): item is number => typeof item === 'number')
      : undefined,
    weekExpression: normalizeText(value.weekExpression),
    weekParity,
    location: normalizeText(value.location),
    buildingId: normalizeText(value.buildingId) || null,
    buildingName: normalizeText(value.buildingName),
    tags: Array.isArray(value.tags)
      ? value.tags.filter((item): item is string => typeof item === 'string')
      : normalizeText(value.tags),
    notes: normalizeText(value.notes),
    color: normalizeText(value.color) || null,
    source,
    createdAt: normalizeText(value.createdAt),
    updatedAt: normalizeText(value.updatedAt),
  });
};

const resolveStorage = (provided?: StorageLike | null): StorageLike | null => {
  if (provided === null) return null;
  if (provided !== undefined) return provided;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function loadCourses(options: CourseStorageOptions = {}): LoadCoursesResult {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return {
      status: 'unavailable',
      courses: [],
      issues: [],
      message: '浏览器存储不可用，个人课表未被修改。',
    };
  }

  const key = options.key ?? SCHEDULE_STORAGE_KEY;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    return {
      status: 'error',
      courses: [],
      issues: [],
      message: `读取个人课表失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!raw) return { status: 'empty', courses: [], issues: [] };

  try {
    const decoded: unknown = JSON.parse(raw);
    const courseValues = Array.isArray(decoded)
      ? decoded
      : isRecord(decoded) && Array.isArray(decoded.courses)
        ? decoded.courses
        : null;
    if (!courseValues) throw new Error('存储格式不受支持');

    const issues: string[] = [];
    const courses: Course[] = [];
    courseValues.forEach((value, index) => {
      try {
        courses.push(courseFromUnknown(value));
      } catch (error) {
        issues.push(`第 ${index + 1} 条记录已跳过：${error instanceof Error ? error.message : String(error)}`);
      }
    });
    if (courses.length === 0 && courseValues.length > 0) {
      return {
        status: 'error',
        courses: [],
        issues,
        message: '已保存的数据无法解析；原始浏览器数据仍保留。',
      };
    }
    return { status: courses.length > 0 ? 'loaded' : 'empty', courses, issues };
  } catch (error) {
    return {
      status: 'error',
      courses: [],
      issues: [],
      message: `个人课表格式损坏；原始浏览器数据仍保留：${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function saveCourses(
  courses: readonly Course[],
  options: CourseStorageOptions = {},
): SaveCoursesResult {
  const storage = resolveStorage(options.storage);
  if (!storage) {
    return {
      status: 'unavailable',
      courses: [...courses],
      message: '浏览器存储不可用，现有个人课表未被覆盖。',
    };
  }

  let validated: Course[];
  try {
    validated = courses.map(courseFromUnknown);
  } catch (error) {
    return {
      status: 'error',
      courses: [...courses],
      message: `课表校验失败，未写入浏览器：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const savedAt = nowIso();
  const envelope: PersonalStorageEnvelope = {
    schemaVersion: PERSONAL_SCHEMA_VERSION,
    savedAt,
    courses: validated,
  };
  try {
    storage.setItem(options.key ?? SCHEDULE_STORAGE_KEY, JSON.stringify(envelope));
    return { status: 'saved', courses: validated, savedAt };
  } catch (error) {
    return {
      status: 'error',
      courses: [...courses],
      message: `保存失败，原课表未被覆盖：${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

interface CsvMatrixResult {
  rows: string[][];
  error?: string;
}

const parseCsvMatrix = (input: string): CsvMatrixResult => {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (quoted) return { rows: [], error: 'CSV 中存在未闭合的引号' };
  row.push(cell);
  if (row.some((value) => value.trim() !== '') || rows.length === 0) rows.push(row);
  return { rows };
};

type CsvField =
  | 'id'
  | 'name'
  | 'teacher'
  | 'weekday'
  | 'startPeriod'
  | 'endPeriod'
  | 'periods'
  | 'weeks'
  | 'parity'
  | 'location'
  | 'buildingId'
  | 'buildingName'
  | 'tags'
  | 'notes'
  | 'color';

const HEADER_ALIASES: Record<CsvField, readonly string[]> = {
  id: ['id', 'courseid', '课程id', '课程编号'],
  name: ['课程名称', '课程名', '课程', '科目', 'subject', 'course', 'name', 'title'],
  teacher: ['教师', '老师', '任课教师', 'teacher', 'instructor'],
  weekday: ['星期', '星期几', '周几', '上课星期', 'weekday', 'day'],
  startPeriod: ['开始节次', '开始节数', '开始节', '起始节次', 'startperiod', 'startsection', 'start'],
  endPeriod: ['结束节次', '结束节数', '结束节', '终止节次', 'endperiod', 'endsection', 'end'],
  periods: ['节次', '节数', '上课节次', '时间段', 'periods', 'sections'],
  weeks: ['周次', '周数', '上课周次', 'weeks', 'week'],
  parity: ['单双周', '周类型', '周次类型', 'parity'],
  location: ['地点', '上课地点', '教室', 'location', 'classroom', 'room'],
  buildingId: ['楼座id', '教学楼id', 'buildingid'],
  buildingName: ['楼座', '教学楼', '楼栋', 'building', 'buildingname'],
  tags: ['标签', '兴趣标签', '课程标签', '类别', 'tags', 'interests', 'category'],
  notes: ['备注', '说明', 'notes', 'note'],
  color: ['颜色', '色值', 'color'],
};

const getHeaderIndexes = (headers: readonly string[]): Partial<Record<CsvField, number>> => {
  const normalizedHeaders = headers.map(normalizeForMatch);
  const indexes: Partial<Record<CsvField, number>> = {};
  (Object.keys(HEADER_ALIASES) as CsvField[]).forEach((field) => {
    const aliases = HEADER_ALIASES[field].map(normalizeForMatch);
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (index >= 0) indexes[field] = index;
  });
  return indexes;
};

const cellAt = (
  row: readonly string[],
  indexes: Partial<Record<CsvField, number>>,
  field: CsvField,
): string => {
  const index = indexes[field];
  return index === undefined ? '' : (row[index] ?? '').trim();
};

const parsePeriods = (value: string): [number, number] | null => {
  const matches = value.normalize('NFKC').match(/\d+/g);
  if (!matches?.length) return null;
  const start = Number.parseInt(matches[0], 10);
  const end = Number.parseInt(matches[1] ?? matches[0], 10);
  return [start, end];
};

const parseParity = (value: string): WeekParity | undefined => {
  const normalized = normalizeForMatch(value);
  if (!normalized) return undefined;
  if (/^(?:单|单周|odd)$/.test(normalized)) return 'odd';
  if (/^(?:双|双周|even)$/.test(normalized)) return 'even';
  if (/^(?:全|每周|全周|all)$/.test(normalized)) return 'all';
  if (/^(?:自定义|custom)$/.test(normalized)) return 'custom';
  return undefined;
};

const resolveBuilding = (
  rawId: string,
  rawName: string,
  buildings: readonly BuildingReference[],
): { buildingId: string | null; buildingName: string; matched: boolean } => {
  if (rawId) {
    const byId = buildings.find((building) => normalizeForMatch(building.id) === normalizeForMatch(rawId));
    if (byId) {
      return { buildingId: byId.id, buildingName: rawName || byId.name || '', matched: true };
    }
  }

  if (rawName) {
    const needle = normalizeForMatch(rawName);
    const byName = buildings.find((building) =>
      [building.name ?? '', ...(building.aliases ?? [])].some(
        (candidate) => normalizeForMatch(candidate) === needle,
      ),
    );
    if (byName) return { buildingId: byName.id, buildingName: rawName, matched: true };
  }
  return { buildingId: null, buildingName: rawName || rawId, matched: !rawId && !rawName };
};

const courseSignature = (course: Course): string =>
  [
    normalizeForMatch(course.name),
    normalizeForMatch(course.teacher),
    course.weekday,
    course.startPeriod,
    course.endPeriod,
    course.weeks.join('.'),
    normalizeForMatch(course.location),
    normalizeForMatch(course.buildingId ?? ''),
    normalizeForMatch(course.buildingName),
  ].join('|');

export function parseScheduleCsv(
  csv: string,
  options: ParseScheduleCsvOptions = {},
): ImportPreview {
  const matrix = parseCsvMatrix(csv);
  if (matrix.error) {
    const issue: ImportIssue = {
      severity: 'error',
      row: 1,
      code: 'invalid-csv',
      message: matrix.error,
    };
    return {
      status: 'invalid',
      courses: [],
      errors: [issue],
      warnings: [],
      issues: [issue],
      headers: [],
      totalRows: 0,
      acceptedRows: 0,
    };
  }

  const firstNonEmpty = matrix.rows.findIndex((row) => row.some((cell) => cell.trim() !== ''));
  if (firstNonEmpty < 0) {
    const issue: ImportIssue = {
      severity: 'error',
      row: 1,
      code: 'empty-file',
      message: 'CSV 文件为空。',
    };
    return {
      status: 'invalid',
      courses: [],
      errors: [issue],
      warnings: [],
      issues: [issue],
      headers: [],
      totalRows: 0,
      acceptedRows: 0,
    };
  }

  const headers = matrix.rows[firstNonEmpty].map((header) => header.trim());
  const indexes = getHeaderIndexes(headers);
  const issues: ImportIssue[] = [];
  const normalizedHeaders = headers.map(normalizeForMatch);
  (Object.keys(HEADER_ALIASES) as CsvField[]).forEach((field) => {
    const aliases = HEADER_ALIASES[field].map(normalizeForMatch);
    const matches = normalizedHeaders.filter((header) => aliases.includes(header));
    if (matches.length > 1) {
      issues.push({
        severity: 'error',
        row: firstNonEmpty + 1,
        code: 'duplicate-semantic-header',
        message: `多个列同时表示“${headers[indexes[field] ?? 0] || field}”，请只保留一列。`,
      });
    }
  });
  if (indexes.name === undefined) {
    issues.push({ severity: 'error', row: firstNonEmpty + 1, code: 'missing-name-header', message: '缺少“课程名称”列。' });
  }
  if (indexes.weekday === undefined) {
    issues.push({ severity: 'error', row: firstNonEmpty + 1, code: 'missing-weekday-header', message: '缺少“星期”列。' });
  }
  if (indexes.periods === undefined && indexes.startPeriod === undefined) {
    issues.push({ severity: 'error', row: firstNonEmpty + 1, code: 'missing-period-header', message: '缺少“节次”或“开始节次”列。' });
  }
  if (issues.some((issue) => issue.severity === 'error')) {
    return {
      status: 'invalid',
      courses: [],
      errors: issues,
      warnings: [],
      issues,
      headers,
      totalRows: Math.max(0, matrix.rows.length - firstNonEmpty - 1),
      acceptedRows: 0,
    };
  }

  const buildings = options.buildings ?? [];
  const maxWeek = options.maxWeek ?? DEFAULT_MAX_WEEK;
  const maxPeriod = options.maxPeriod ?? DEFAULT_MAX_PERIOD;
  const courses: Course[] = [];
  const seen = new Set((options.existingCourses ?? []).map(courseSignature));
  let totalRows = 0;

  matrix.rows.slice(firstNonEmpty + 1).forEach((sourceRow, offset) => {
    if (sourceRow.every((cell) => cell.trim() === '')) return;
    totalRows += 1;
    const rowNumber = firstNonEmpty + offset + 2;
    // A few WakeUp-derived seven-column files leave commas in the final 周数
    // field unquoted. Recover that specific, unambiguous case without silently
    // accepting shifted columns in other CSV layouts.
    let row = sourceRow;
    if (sourceRow.length > headers.length && indexes.weeks === headers.length - 1) {
      row = [
        ...sourceRow.slice(0, headers.length - 1),
        sourceRow.slice(headers.length - 1).join(','),
      ];
      issues.push({
        severity: 'warning',
        row: rowNumber,
        column: '周次',
        code: 'recovered-unquoted-weeks',
        message: '周次中的逗号未按 CSV 规范加引号，已自动恢复。',
      });
    } else if (sourceRow.length > headers.length) {
      issues.push({
        severity: 'error',
        row: rowNumber,
        code: 'too-many-columns',
        message: `本行有 ${sourceRow.length} 列，但表头只有 ${headers.length} 列；请检查未加引号的逗号。`,
      });
      return;
    }
    const name = cellAt(row, indexes, 'name');
    const weekdayText = cellAt(row, indexes, 'weekday');
    const combinedPeriods = cellAt(row, indexes, 'periods');
    const parsedCombinedPeriods = combinedPeriods ? parsePeriods(combinedPeriods) : null;
    const startPeriod = cellAt(row, indexes, 'startPeriod') || parsedCombinedPeriods?.[0] || '';
    const endPeriod = cellAt(row, indexes, 'endPeriod') || parsedCombinedPeriods?.[1] || startPeriod;
    const weeksText = cellAt(row, indexes, 'weeks');
    const parityText = cellAt(row, indexes, 'parity');
    const parity = parseParity(parityText);
    if (parityText && parity === undefined) {
      issues.push({
        severity: 'error',
        row: rowNumber,
        column: '单双周',
        code: 'invalid-parity',
        message: `无法识别单双周：${parityText}`,
        value: parityText,
      });
      return;
    }

    const rawBuildingId = cellAt(row, indexes, 'buildingId');
    const rawBuildingName = cellAt(row, indexes, 'buildingName');
    const resolvedBuilding = resolveBuilding(rawBuildingId, rawBuildingName, buildings);
    if (!resolvedBuilding.matched) {
      issues.push({
        severity: 'warning',
        row: rowNumber,
        column: rawBuildingId ? '楼座ID' : '楼座',
        code: 'unmatched-building',
        message: `未匹配楼座“${rawBuildingName || rawBuildingId}”，已保留原始文字。`,
        value: rawBuildingName || rawBuildingId,
      });
    }

    try {
      const course = createCourse(
        {
          id: cellAt(row, indexes, 'id') || undefined,
          name,
          teacher: cellAt(row, indexes, 'teacher'),
          weekday: weekdayText,
          startPeriod,
          endPeriod,
          weekExpression: weeksText,
          weekParity: parity,
          location: cellAt(row, indexes, 'location'),
          buildingId: resolvedBuilding.buildingId,
          buildingName: resolvedBuilding.buildingName,
          tags: cellAt(row, indexes, 'tags'),
          notes: cellAt(row, indexes, 'notes'),
          color: cellAt(row, indexes, 'color') || null,
          source: 'csv',
        },
        { maxWeek, maxPeriod },
      );
      if (!weeksText) {
        issues.push({
          severity: 'warning',
          row: rowNumber,
          column: '周次',
          code: 'default-weeks',
          message: `周次为空，已按 1-${maxWeek} 周处理。`,
        });
      }
      const signature = courseSignature(course);
      if (seen.has(signature)) {
        issues.push({
          severity: 'warning',
          row: rowNumber,
          code: 'duplicate-course',
          message: `“${course.name}”与已有课程重复，预览中已跳过。`,
        });
        return;
      }
      seen.add(signature);
      courses.push(course);
    } catch (error) {
      issues.push({
        severity: 'error',
        row: rowNumber,
        code: 'invalid-course',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  return {
    status: errors.length > 0 ? 'invalid' : 'ready',
    courses,
    errors,
    warnings,
    issues,
    headers,
    totalRows,
    acceptedRows: courses.length,
  };
}

const escapeCsvCell = (value: unknown): string => {
  const raw = String(value ?? '');
  // Prevent spreadsheet programs from treating user-entered text as a formula.
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportScheduleCsv(
  courses: readonly Course[],
  options: { includeBom?: boolean } = {},
): string {
  const header = [
    '课程ID',
    '课程名称',
    '教师',
    '星期',
    '开始节次',
    '结束节次',
    '周次',
    '单双周',
    '地点',
    '楼座ID',
    '楼座名称',
    '兴趣标签',
    '备注',
    '颜色',
  ];
  const rows = courses.map((course) => [
    course.id,
    course.name,
    course.teacher,
    WEEKDAY_LABELS[course.weekday],
    course.startPeriod,
    course.endPeriod,
    formatWeekExpression(course.weeks),
    course.weekParity === 'odd' ? '单周' : course.weekParity === 'even' ? '双周' : course.weekParity === 'all' ? '每周' : '自定义',
    course.location,
    course.buildingId ?? '',
    course.buildingName,
    course.tags.join('|'),
    course.notes,
    course.color ?? '',
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return options.includeBom === false ? csv : `\uFEFF${csv}`;
}

export function courseOccursInWeek(course: Pick<Course, 'weeks'>, week: number): boolean {
  return Number.isInteger(week) && week > 0 && course.weeks.includes(week);
}

export function coursesConflict(
  first: Pick<Course, 'weekday' | 'startPeriod' | 'endPeriod' | 'weeks'>,
  second: Pick<Course, 'weekday' | 'startPeriod' | 'endPeriod' | 'weeks'>,
  week?: number,
): boolean {
  if (first.weekday !== second.weekday) return false;
  if (first.endPeriod < second.startPeriod || second.endPeriod < first.startPeriod) return false;
  if (week !== undefined) {
    return courseOccursInWeek(first, week) && courseOccursInWeek(second, week);
  }
  const secondWeeks = new Set(second.weeks);
  return first.weeks.some((candidate) => secondWeeks.has(candidate));
}

export function getFreePeriods(
  courses: readonly Course[],
  options: { week: number; weekdays?: readonly Weekday[]; maxPeriod?: number },
): FreePeriod[] {
  const maxPeriod = Math.max(1, Math.trunc(options.maxPeriod ?? DEFAULT_MAX_PERIOD));
  const weekdays = options.weekdays ?? ([1, 2, 3, 4, 5, 6, 7] as const);
  const result: FreePeriod[] = [];
  weekdays.forEach((weekday) => {
    const occupied = new Set<number>();
    courses.forEach((course) => {
      if (course.weekday !== weekday || !courseOccursInWeek(course, options.week)) return;
      range(course.startPeriod, course.endPeriod).forEach((period) => occupied.add(period));
    });
    let start: number | null = null;
    for (let period = 1; period <= maxPeriod + 1; period += 1) {
      const isFree = period <= maxPeriod && !occupied.has(period);
      if (isFree && start === null) start = period;
      if (!isFree && start !== null) {
        result.push({ weekday, startPeriod: start, endPeriod: period - 1 });
        start = null;
      }
    }
  });
  return result;
}

const readCommunityCache = (storage: StorageLike | null): CommunityScheduleRecord[] => {
  if (!storage) return [];
  const raw = storage.getItem(COMMUNITY_STORAGE_KEY);
  if (!raw) return [];
  const decoded: unknown = JSON.parse(raw);
  if (!isRecord(decoded) || !Array.isArray(decoded.schedules)) {
    throw new Error('社区课表缓存格式不受支持');
  }
  const records: CommunityScheduleRecord[] = [];
  decoded.schedules.forEach((value) => {
    if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.courses)) return;
    const userId = normalizeText(value.user.id);
    if (!userId) return;
    const user: CommunityUser = {
      id: userId,
      name: normalizeText(value.user.name) || '匿名同学',
      interests: normalizeTags(value.user.interests),
    };
    const courses: Course[] = [];
    value.courses.forEach((courseValue) => {
      try {
        courses.push(courseFromUnknown(courseValue));
      } catch {
        // One malformed community row must not make the rest of the pool unusable.
      }
    });
    records.push({ user, courses, updatedAt: normalizeText(value.updatedAt) || nowIso() });
  });
  return records;
};

const writeCommunityCache = (
  storage: StorageLike | null,
  schedules: readonly CommunityScheduleRecord[],
): boolean => {
  if (!storage) return false;
  const envelope: CommunityStorageEnvelope = {
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    savedAt: nowIso(),
    schedules: [...schedules],
  };
  storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(envelope));
  return true;
};

const flattenCommunitySchedules = (
  schedules: readonly CommunityScheduleRecord[],
): CommunityCourse[] =>
  schedules.flatMap((schedule) =>
    schedule.courses.map((course) => ({
      ...course,
      source: 'community' as const,
      ownerId: schedule.user.id,
      ownerName: schedule.user.name,
      ownerInterests: [...schedule.user.interests],
      sharedAt: schedule.updatedAt,
    })),
  );

const resolveCommunityUserId = (storage: StorageLike | null, requested?: string): string => {
  const normalizedRequested = normalizeText(requested);
  if (normalizedRequested) return normalizedRequested;
  try {
    const existing = storage?.getItem(COMMUNITY_USER_ID_KEY);
    if (existing) return existing;
    const generated = makeId('user');
    storage?.setItem(COMMUNITY_USER_ID_KEY, generated);
    return generated;
  } catch {
    return makeId('user');
  }
};

const resolveFetcher = (provided?: typeof fetch): typeof fetch | null => {
  if (provided) return provided;
  return typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
};

const unavailableHttpStatus = (status: number): boolean =>
  status === 404 || status === 408 || status === 425 || status === 429 || status >= 500;

export async function syncCommunitySchedule(
  courses: readonly Course[],
  options: CommunitySyncOptions = {},
): Promise<CommunitySyncResult> {
  const storage = resolveStorage(options.storage);
  const userId = resolveCommunityUserId(storage, options.userId);
  let validated: Course[];
  try {
    validated = courses.map(courseFromUnknown);
  } catch (error) {
    return {
      status: 'error',
      remoteStatus: 'error',
      userId,
      cached: false,
      sharedCourseCount: 0,
      message: `社区同步前校验失败；个人课表未被修改：${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const record: CommunityScheduleRecord = {
    user: {
      id: userId,
      name: normalizeText(options.userName) || '匿名同学',
      interests: uniqueStrings(options.interests ?? []),
    },
    courses: validated,
    updatedAt: nowIso(),
  };

  let cached = false;
  try {
    const schedules = readCommunityCache(storage).filter((item) => item.user.id !== userId);
    schedules.push(record);
    cached = writeCommunityCache(storage, schedules);
  } catch {
    cached = false;
  }

  const endpoint = normalizeText(options.endpoint);
  if (!endpoint) {
    return {
      status: cached ? 'local-only' : 'unavailable',
      remoteStatus: 'not-configured',
      userId,
      cached,
      sharedCourseCount: validated.length,
      message: cached
        ? '未配置社区接口，课表已加入当前浏览器的本地汇总池。'
        : '未配置社区接口且浏览器缓存不可用；个人课表未被修改。',
    };
  }

  const fetcher = resolveFetcher(options.fetcher);
  if (!fetcher) {
    return {
      status: 'unavailable',
      remoteStatus: 'unavailable',
      userId,
      cached,
      sharedCourseCount: validated.length,
      message: cached
        ? '网络请求能力不可用，已保留本地社区缓存；个人课表未被修改。'
        : '网络请求能力和社区缓存均不可用；个人课表未被修改。',
    };
  }

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, user: record.user, courses: validated }),
      signal: options.signal,
    });
    if (!response.ok) {
      const unavailable = unavailableHttpStatus(response.status);
      return {
        status: unavailable ? 'unavailable' : 'error',
        remoteStatus: unavailable ? 'unavailable' : 'error',
        userId,
        cached,
        sharedCourseCount: validated.length,
        message: `社区接口返回 ${response.status}；${cached ? '本地汇总缓存仍可使用，' : ''}个人课表未被修改。`,
      };
    }
    return {
      status: 'synced',
      remoteStatus: 'synced',
      userId,
      cached,
      sharedCourseCount: validated.length,
      message: cached ? '课表已同步到社区并写入本地汇总缓存。' : '课表已同步到社区。',
    };
  } catch (error) {
    return {
      status: 'unavailable',
      remoteStatus: 'unavailable',
      userId,
      cached,
      sharedCourseCount: validated.length,
      message: `社区接口不可用；${cached ? '本地汇总缓存仍可使用，' : ''}个人课表未被修改：${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

const schedulesFromRemotePayload = (payload: unknown): CommunityScheduleRecord[] => {
  const root = Array.isArray(payload) ? { courses: payload } : payload;
  if (!isRecord(root)) throw new Error('社区接口返回的不是对象');

  if (Array.isArray(root.schedules)) {
    return root.schedules.map((value, index) => {
      if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.courses)) {
        throw new Error(`第 ${index + 1} 份社区课表格式错误`);
      }
      const id = normalizeText(value.user.id);
      if (!id) throw new Error(`第 ${index + 1} 份社区课表缺少用户 ID`);
      return {
        user: {
          id,
          name: normalizeText(value.user.name) || '匿名同学',
          interests: normalizeTags(value.user.interests),
        },
        courses: value.courses.map(courseFromUnknown),
        updatedAt: normalizeText(value.updatedAt) || nowIso(),
      };
    });
  }

  if (Array.isArray(root.courses)) {
    const grouped = new Map<string, CommunityScheduleRecord>();
    root.courses.forEach((value, index) => {
      if (!isRecord(value)) throw new Error(`第 ${index + 1} 条社区课程格式错误`);
      const ownerId = normalizeText(value.ownerId) || normalizeText(value.userId);
      if (!ownerId) throw new Error(`第 ${index + 1} 条社区课程缺少用户 ID`);
      const current = grouped.get(ownerId) ?? {
        user: {
          id: ownerId,
          name: normalizeText(value.ownerName) || normalizeText(value.userName) || '匿名同学',
          interests: normalizeTags(value.ownerInterests),
        },
        courses: [],
        updatedAt: normalizeText(value.sharedAt) || normalizeText(value.updatedAt) || nowIso(),
      };
      current.courses.push(courseFromUnknown(value));
      grouped.set(ownerId, current);
    });
    return [...grouped.values()];
  }

  throw new Error('社区接口响应缺少 schedules 或 courses');
};

export async function loadCommunityCourses(
  options: CommunityLoadOptions = {},
): Promise<CommunityLoadResult> {
  const storage = resolveStorage(options.storage);
  let cachedCourses: CommunityCourse[] = [];
  let cacheError = '';
  try {
    cachedCourses = flattenCommunitySchedules(readCommunityCache(storage));
  } catch (error) {
    cacheError = error instanceof Error ? error.message : String(error);
  }

  const endpoint = normalizeText(options.endpoint);
  if (!endpoint) {
    if (cachedCourses.length > 0) {
      return {
        status: 'loaded',
        remoteStatus: 'not-configured',
        source: 'cache',
        courses: cachedCourses,
        message: '未配置社区接口，当前显示浏览器中的本地汇总。',
      };
    }
    return {
      status: cacheError ? 'error' : 'empty',
      remoteStatus: 'not-configured',
      source: 'none',
      courses: [],
      message: cacheError ? `社区缓存读取失败：${cacheError}` : '社区课表为空，且未配置远程接口。',
    };
  }

  const fetcher = resolveFetcher(options.fetcher);
  if (!fetcher) {
    return {
      status: 'unavailable',
      remoteStatus: 'unavailable',
      source: cachedCourses.length > 0 ? 'cache' : 'none',
      courses: cachedCourses,
      message: cachedCourses.length > 0
        ? '网络请求能力不可用，当前显示本地社区缓存。'
        : '网络请求能力不可用，且没有本地社区缓存。',
    };
  }

  try {
    const response = await fetcher(endpoint, { method: 'GET', signal: options.signal });
    if (!response.ok) {
      const unavailable = unavailableHttpStatus(response.status);
      return {
        status: unavailable ? 'unavailable' : 'error',
        remoteStatus: unavailable ? 'unavailable' : 'error',
        source: cachedCourses.length > 0 ? 'cache' : 'none',
        courses: cachedCourses,
        message: `社区接口返回 ${response.status}；${
          cachedCourses.length > 0 ? '当前显示本地缓存。' : '没有可用缓存。'
        }`,
      };
    }

    const schedules = schedulesFromRemotePayload(await response.json());
    const remoteCourses = flattenCommunitySchedules(schedules);
    try {
      writeCommunityCache(storage, schedules);
    } catch {
      // Remote data can still be shown even if the optional cache write fails.
    }
    return {
      status: remoteCourses.length > 0 ? 'loaded' : 'empty',
      remoteStatus: 'synced',
      source: 'remote',
      courses: remoteCourses,
      message: remoteCourses.length > 0 ? '已加载社区汇总课表。' : '社区汇总课表为空。',
    };
  } catch (error) {
    return {
      status: 'unavailable',
      remoteStatus: 'unavailable',
      source: cachedCourses.length > 0 ? 'cache' : 'none',
      courses: cachedCourses,
      message: `社区接口不可用；${cachedCourses.length > 0 ? '当前显示本地缓存：' : ''}${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export function aggregateCommunityCourses(
  courses: readonly CommunityCourse[],
): AggregatedCommunityCourse[] {
  const groups = new Map<string, CommunityCourse[]>();
  courses.forEach((course) => {
    const key = courseSignature(course);
    groups.set(key, [...(groups.get(key) ?? []), course]);
  });

  return [...groups.entries()]
    .map(([signature, group]) => {
      const representative = group[0];
      return {
        ...representative,
        id: `aggregate-${stableHash(signature)}`,
        source: 'community' as const,
        ownerIds: uniqueStrings(group.map((course) => course.ownerId)),
        ownerNames: uniqueStrings(group.map((course) => course.ownerName)),
        ownerCount: new Set(group.map((course) => course.ownerId)).size,
        ownerInterests: uniqueStrings(group.flatMap((course) => course.ownerInterests)),
      };
    })
    .sort(compareCourses);
}

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export function compareCourses(
  first: Pick<Course, 'weekday' | 'startPeriod' | 'endPeriod' | 'name'>,
  second: Pick<Course, 'weekday' | 'startPeriod' | 'endPeriod' | 'name'>,
): number {
  return (
    first.weekday - second.weekday ||
    first.startPeriod - second.startPeriod ||
    first.endPeriod - second.endPeriod ||
    first.name.localeCompare(second.name, 'zh-CN')
  );
}

export function findSitInCourses(
  communityCourses: readonly CommunityCourse[],
  personalCourses: readonly Course[],
  filter: SitInFilter,
): SitInSuggestion[] {
  const requestedInterests = uniqueStrings(filter.interests ?? []);
  const normalizedInterests = requestedInterests.map(normalizeForMatch);
  const selectedBuildings = new Set(filter.buildingIds ?? []);
  const query = normalizeForMatch(filter.query ?? '');
  const onlyWhenFree = filter.onlyWhenFree ?? true;

  return aggregateCommunityCourses(communityCourses)
    .filter((course) => !filter.currentUserId || !course.ownerIds.includes(filter.currentUserId))
    .filter((course) => courseOccursInWeek(course, filter.week))
    .filter((course) => filter.weekday === undefined || course.weekday === filter.weekday)
    .filter(
      (course) =>
        selectedBuildings.size === 0 ||
        (course.buildingId !== null && selectedBuildings.has(course.buildingId)),
    )
    .map((course): SitInSuggestion => {
      const searchable = normalizeForMatch(
        [course.name, course.teacher, course.location, course.buildingName, course.notes, ...course.tags].join(' '),
      );
      const matchedInterests = requestedInterests.filter((_, index) =>
        searchable.includes(normalizedInterests[index]),
      );
      const conflictsWithPersonalSchedule = personalCourses.some((personal) =>
        coursesConflict(course, personal, filter.week),
      );
      const score = matchedInterests.length * 100 + Math.min(course.ownerCount, 20);
      return { ...course, matchedInterests, conflictsWithPersonalSchedule, score };
    })
    .filter((course) => !query || normalizeForMatch(
      [course.name, course.teacher, course.location, course.buildingName, course.notes, ...course.tags].join(' '),
    ).includes(query))
    .filter((course) => normalizedInterests.length === 0 || course.matchedInterests.length > 0)
    .filter((course) => !onlyWhenFree || !course.conflictsWithPersonalSchedule)
    .sort((first, second) => second.score - first.score || compareCourses(first, second));
}
