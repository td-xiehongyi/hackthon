import type { TimetableCourse, TimetableSnapshot, WeekParity } from './types';

// 与教务系统课表一致：周日列在最左侧。
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export const PERIODS = ['01–02', '03–04', '05–06', '07–08', '09–10', '11–12'];
export const CSV_HEADER = ['课程名称', '教师', '星期', '起始节', '结束节', '周次', '单双周', '楼座ID', '地点原文', '教室'];

export function normalizeCourse(value: Partial<TimetableCourse>, fallbackId: string): TimetableCourse | null {
  const title = String(value.title ?? '').trim();
  const weekday = Number(value.weekday);
  const legacyPeriod = (value as Partial<TimetableCourse> & { period?: number }).period;
  const startPeriod = Number(value.startPeriod ?? legacyPeriod);
  const endPeriod = Number(value.endPeriod ?? legacyPeriod ?? startPeriod);
  if (!title || !Number.isInteger(weekday) || weekday < 0 || weekday >= WEEKDAYS.length) return null;
  if (!Number.isInteger(startPeriod) || startPeriod < 0 || startPeriod >= PERIODS.length) return null;
  if (!Number.isInteger(endPeriod) || endPeriod < startPeriod || endPeriod >= PERIODS.length) return null;
  const parity: WeekParity = value.parity === 'odd' || value.parity === 'even' ? value.parity : 'all';
  return {
    id: String(value.id || fallbackId),
    title,
    teacher: String(value.teacher ?? '').trim(),
    weekday,
    startPeriod,
    endPeriod,
    weeks: String(value.weeks ?? '').trim(),
    parity,
    buildingId: String(value.buildingId ?? '').trim(),
    location: String(value.location ?? '').trim(),
    room: String(value.room ?? '').trim(),
  };
}

export function normalizeSnapshot(value: unknown): TimetableSnapshot {
  if (!value || typeof value !== 'object') return { schemaVersion: 1, semester: '2026–2027 第一学期', courses: [] };
  const object = value as { semester?: unknown; courses?: unknown };
  const rawCourses = Array.isArray(object.courses) ? object.courses : [];
  const courses = rawCourses.flatMap((course, index) => {
    const item = course && typeof course === 'object' ? course as Partial<TimetableCourse> : {};
    const normalized = normalizeCourse(item, `course-${index + 1}`);
    return normalized ? [normalized] : [];
  });
  return { schemaVersion: 1, semester: String(object.semester || '2026–2027 第一学期'), courses };
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function coursesToCsv(snapshot: TimetableSnapshot): string {
  const rows = snapshot.courses.map((course) => [
    course.title, course.teacher, `星期${WEEKDAYS[course.weekday]}`, String(course.startPeriod * 2 + 1), String(course.endPeriod * 2 + 2),
    course.weeks, course.parity === 'odd' ? '单周' : course.parity === 'even' ? '双周' : '每周',
    course.buildingId, course.location, course.room,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { values.push(current.trim()); current = ''; continue; }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseWeekday(value: string): number {
  const match = value.match(/[一二三四五六日天]/);
  if (!match) return -1;
  return WEEKDAYS.indexOf(match[0] === '天' ? '日' : match[0]);
}

function parsePeriod(value: string): number {
  const n = Number(value.match(/\d+/)?.[0]);
  if (!Number.isInteger(n) || n < 1 || n > PERIODS.length * 2) return -1;
  return Math.floor((n - 1) / 2);
}

export function parseCoursesCsv(text: string): { courses: TimetableCourse[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  const errors: string[] = [];
  const courses: TimetableCourse[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line);
    const course = normalizeCourse({
      title: cells[0], teacher: cells[1], weekday: parseWeekday(cells[2] ?? ''),
      startPeriod: parsePeriod(cells[3] ?? ''), endPeriod: parsePeriod(cells[4] ?? cells[3] ?? ''),
      weeks: cells[5], parity: cells[6]?.includes('单') ? 'odd' : cells[6]?.includes('双') ? 'even' : 'all',
      buildingId: cells[7], location: cells[8], room: cells[9],
    }, `import-${Date.now()}-${index}`);
    if (course) courses.push(course);
    else errors.push(`第 ${index + 2} 行格式不完整`);
  });
  if (!lines.length || lines[0].split(',')[0] !== CSV_HEADER[0]) errors.unshift('CSV 首行应为规定模板标题');
  return { courses, errors };
}
