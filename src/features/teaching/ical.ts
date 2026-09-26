import type { Course } from './model';

/**
 * Clock times used by the CSU 12-period timetable.
 *
 * These values are only used when exporting a calendar.  The schedule UI
 * still keeps its period labels independent from an unverified school
 * calendar.  The mapping follows the public CSU timetable examples listed in
 * docs/06_GitHub参考与许可证.md; users can always keep using CSV when their
 * college uses a different bell schedule.
 */
export const CSU_PERIOD_TIMES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['08:00', '08:45'],
  ['08:55', '09:40'],
  ['10:00', '10:45'],
  ['10:55', '11:40'],
  ['14:00', '14:45'],
  ['14:55', '15:40'],
  ['16:00', '16:45'],
  ['16:55', '17:40'],
  ['19:00', '19:45'],
  ['19:55', '20:40'],
  ['21:00', '21:45'],
  ['21:55', '22:40'],
]);

export interface IcalExportOptions {
  /** Monday of teaching week 1, in YYYY-MM-DD form. */
  semesterStart: string;
  calendarName?: string;
  /** Minutes before class for an optional calendar alarm. Set null to omit. */
  alarmMinutes?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINE_BYTES = 75;

const parseDate = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  // The app's weekday numbering is Monday=1. Requiring Monday prevents a
  // one-day offset from silently shifting every exported class.
  if (date.getUTCDay() !== 1) return null;
  return { year, month, day };
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

const localDateTimeToUtc = (
  date: { year: number; month: number; day: number },
  time: string,
): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  // CSU is in Asia/Shanghai (UTC+08:00), which has no daylight-saving
  // transitions. Constructing UTC and subtracting eight hours keeps the
  // output deterministic on machines in any local timezone.
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hours - 8, minutes, 0));
};

const formatUtc = (date: Date): string => [
  date.getUTCFullYear(),
  pad(date.getUTCMonth() + 1),
  pad(date.getUTCDate()),
].join('') + 'T' + [
  pad(date.getUTCHours()),
  pad(date.getUTCMinutes()),
  pad(date.getUTCSeconds()),
].join('') + 'Z';

/** RFC 5545 text escaping for SUMMARY, DESCRIPTION and LOCATION values. */
export const escapeIcalText = (value: string): string => value
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,');

const stableHash = (value: string): string => {
  // FNV-1a is sufficient here: the value is only a stable event identifier,
  // not a security token.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const foldLine = (line: string): string[] => {
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).byteLength;
    const limit = chunks.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1;
    if (current && bytes + characterBytes > limit) {
      chunks.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += characterBytes;
  }
  chunks.push(current);
  return chunks;
};

const foldLines = (lines: readonly string[]): string => lines.flatMap(foldLine).join('\r\n');

const dateAfterDays = (
  start: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } => {
  const date = new Date(Date.UTC(start.year, start.month - 1, start.day) + days * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const locationFor = (course: Pick<Course, 'buildingName' | 'location'>): string =>
  [course.buildingName, course.location].filter(Boolean).join(' · ');

const descriptionFor = (course: Course, week: number): string => [
  course.teacher ? `任课教师：${course.teacher}` : '',
  `教学周：第${week}周`,
  course.weekExpression ? `周次规则：${course.weekExpression}` : '',
  course.tags.length > 0 ? `标签：${course.tags.join('、')}` : '',
  course.notes,
].filter(Boolean).join('\n');

/**
 * Generate a standards-compatible iCalendar file entirely in the browser.
 * No course data is uploaded. One VEVENT is emitted per actual teaching week
 * so single/double/custom-week courses work in calendar apps without relying
 * on fragile RRULE/EXDATE support.
 */
export function exportScheduleIcal(
  courses: readonly Course[],
  options: IcalExportOptions,
): string {
  const semesterStart = parseDate(options.semesterStart);
  if (!semesterStart) throw new Error('学期第一周必须填写有效的周一日期（YYYY-MM-DD）。');
  const calendarName = options.calendarName?.trim() || '中南大学像素校园课表';
  const alarmMinutes = options.alarmMinutes === null
    ? null
    : Math.max(0, Math.min(24 * 60, Math.trunc(options.alarmMinutes ?? 15)));
  const timestamp = formatUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CSU Pixel Campus//Timetable//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  courses.forEach((course) => {
    course.weeks.forEach((week) => {
      if (!Number.isInteger(week) || week < 1) return;
      const startSlot = CSU_PERIOD_TIMES[course.startPeriod - 1];
      const endSlot = CSU_PERIOD_TIMES[course.endPeriod - 1];
      if (!startSlot || !endSlot) return;
      const date = dateAfterDays(semesterStart, (week - 1) * 7 + course.weekday - 1);
      const start = localDateTimeToUtc(date, startSlot[0]);
      const end = localDateTimeToUtc(date, endSlot[1]);
      const eventKey = [course.id, week, course.weekday, course.startPeriod, course.endPeriod].join('|');
      const location = locationFor(course);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${stableHash(eventKey)}@csu-pixel-campus`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${formatUtc(start)}`,
        `DTEND:${formatUtc(end)}`,
        `SUMMARY:${escapeIcalText(course.name)}`,
        `DESCRIPTION:${escapeIcalText(descriptionFor(course, week))}`,
        ...(location ? [`LOCATION:${escapeIcalText(location)}`] : []),
        ...(course.tags.length > 0 ? [`CATEGORIES:${course.tags.map(escapeIcalText).join(',')}`] : []),
        ...(alarmMinutes === null ? [] : [
          'BEGIN:VALARM',
          `TRIGGER:-PT${alarmMinutes}M`,
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeIcalText(course.name)}`,
          'END:VALARM',
        ]),
        'END:VEVENT',
      );
    });
  });
  lines.push('END:VCALENDAR');
  return `${foldLines(lines)}\r\n`;
}

