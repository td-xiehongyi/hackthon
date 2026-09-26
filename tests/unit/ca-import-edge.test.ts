import { describe, expect, test } from 'vitest';
import { parseCsuScheduleText, parseCsuScheduleHtml } from '../../src/features/teaching/caImport';

describe('edge', () => {
  test('csv time', () => {
    const p = parseCsuScheduleText('课程名称,上课星期,上课时间,任课教师,上课地点,教学周\n大学物理,星期三,第1-2节,王老师,科教楼301,1-8单');
    expect(p.status).toBe('ready');
    expect(p.courses[0]).toMatchObject({ startPeriod: 1, endPeriod: 2 });
  });
  test('md', () => {
    const p = parseCsuScheduleText('|课程名称|星期|节次|周次|\n|---|---|---|---|\n|大学物理|周三|1-2|1-8|');
    expect(p.status).toBe('ready');
    expect(p.acceptedRows).toBe(1);
  });
  test('clock', () => {
    const p = parseCsuScheduleText('课程名称,星期,节次,周次\n物理,周三,08:00-09:40,1-8');
    expect(p.status).not.toBe('ready');
  });
  test('long compact', () => {
    const p = parseCsuScheduleText(JSON.stringify([{ title: '课程名称：物理\n星期：星期一\n节次：01020304\n周次：1-8' }]));
    expect(p.courses[0]).toMatchObject({ startPeriod: 1, endPeriod: 4 });
  });
  test('direct csv compact sections', () => {
    const p = parseCsuScheduleText('课程名称,星期,节次,周次\n物理,周一,0708节,1-8');
    expect(p.courses[0]).toMatchObject({ startPeriod: 7, endPeriod: 8 });
  });
  test('json note', () => {
    const p = parseCsuScheduleText(JSON.stringify([{ jc: '7', xq: '1', title: '实践教学安排', kcmc: '实践教学安排' }]));
    expect(p.acceptedRows).toBe(0);
  });
  test('json xq converts CSU Sunday-first values to Monday-first weekdays', () => {
    const p = parseCsuScheduleText(JSON.stringify([
      { jc: '1', xq: 1, title: '课程名称：周日课\n周次：1-16\n节次：0102节' },
      { jc: '3', xq: 2, title: '课程名称：周一课\n周次：1-16\n节次：0304节' },
      { jc: '5', xq: 7, title: '课程名称：周六课\n周次：1-16\n节次：0506节' },
    ]));
    expect(p.status).toBe('ready');
    expect(p.courses).toHaveLength(3);
    expect(p.courses.map((course) => course.weekday)).toEqual([7, 1, 6]);
  });
  test('json wrapper, xq=0 placeholder and free-time rows are handled locally', () => {
    const p = parseCsuScheduleText(JSON.stringify({ result: { data: [
      { jc: 1, xq: 0, title: '课程名称：占位记录\n周次：1-16\n节次：0102节' },
      { jc: 3, xq: 2, title: '自由时间：课间安排' },
      { jc: 5, xq: 2, title: '课程名称：数据库\n周次：1-16(双周)\n节次：05节' },
    ] } }));
    expect(p.status).toBe('ready');
    expect(p.acceptedRows).toBe(1);
    expect(p.courses[0]).toMatchObject({ name: '数据库', weekday: 1, startPeriod: 5, endPeriod: 5, weeks: [2, 4, 6, 8, 10, 12, 14, 16] });
    expect(p.skippedRows).toBe(2);
    expect(p.warnings.map((issue) => issue.code)).toEqual(expect.arrayContaining(['json-skipped-placeholder', 'json-skipped-free-time']));
  });
  test('json uses jc as a start when title only supplies an ending section', () => {
    const p = parseCsuScheduleText(JSON.stringify([{ jc: 3, xq: 2, title: '课程名称：补充课\n周次：1-16\n节次：04节' }]));
    expect(p.status).toBe('ready');
    expect(p.courses[0]).toMatchObject({ startPeriod: 3, endPeriod: 4 });
  });
  test('json labels allow spaces before the colon and title arrays', () => {
    const p = parseCsuScheduleText(JSON.stringify([{ xq: 2, jc: 1, title: [
      '课程名称 ：数组课', '周次 ：1-16', '节次 ：0102节', '上课地点 ：A101',
    ] }]));
    expect(p.status).toBe('ready');
    expect(p.courses[0]).toMatchObject({ name: '数组课', weekday: 1, startPeriod: 1, endPeriod: 2 });
  });
  test('labelled text also expands a long compact section range', () => {
    const p = parseCsuScheduleText('课程名称：连续节次课\n星期：周二\n节次：01020304\n周次：1-16');
    expect(p.status).toBe('ready');
    expect(p.courses[0]).toMatchObject({ startPeriod: 1, endPeriod: 4 });
  });
  test('recognized empty JSON returns an actionable import error', () => {
    const p = parseCsuScheduleText(JSON.stringify({ data: [] }));
    expect(p.source).toBe('json');
    expect(p.status).toBe('invalid');
    expect(p.errors[0]?.code).toBe('json-no-courses');
  });
  test('html no header counts', () => {
    const p = parseCsuScheduleHtml('<table><tr><td>foo</td></tr></table>');
    expect(p.detectedTableCount).toBe(1);
    expect(p.detectedRows).toBe(1);
  });
});
