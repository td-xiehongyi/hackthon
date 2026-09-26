import { describe, expect, test } from 'vitest';
import { createCourse } from '../../src/features/teaching/model';
import { escapeIcalText, exportScheduleIcal } from '../../src/features/teaching/ical';

describe('课表 iCalendar 导出', () => {
  test('按周次和星期生成实际事件，并使用 CSU 时段', () => {
    const course = createCourse({
      id: 'math-1',
      name: '高等数学,上册',
      teacher: '张老师',
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      weekExpression: '1-2',
      buildingName: 'A座',
      location: '201',
      tags: ['数学', '基础'],
    });
    const ical = exportScheduleIcal([course], { semesterStart: '2026-09-07' });

    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('X-WR-TIMEZONE:Asia/Shanghai');
    expect(ical.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    // Week 1 Monday 08:00 Asia/Shanghai = 00:00Z.
    expect(ical).toContain('DTSTART:20260907T000000Z');
    expect(ical).toContain('DTEND:20260907T014000Z');
    expect(ical).toContain('SUMMARY:高等数学\\,上册');
    expect(ical).toContain('LOCATION:A座 · 201');
    expect(ical).toContain('CATEGORIES:数学,基础');
  });

  test('转义描述字段并保留单双周展开结果', () => {
    const course = createCourse({
      id: 'lab',
      name: '实验;设计',
      weekday: 3,
      startPeriod: 11,
      endPeriod: 12,
      weekExpression: '1-5单',
      notes: '带逗号,和换行\n的备注',
    });
    const ical = exportScheduleIcal([course], { semesterStart: '2026-09-07', alarmMinutes: null });
    expect(ical.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ical).toContain('SUMMARY:实验\\;设计');
    // Long DESCRIPTION lines may be RFC-5545 folded between the escaped
    // fields, so assert both fragments rather than relying on one physical
    // line.
    expect(ical).toContain('带逗号\\,和');
    expect(ical).toContain('换行\\n的备注');
    expect(ical).not.toContain('BEGIN:VALARM');
  });

  test('拒绝非周一的学期起始日期，避免整体错一天', () => {
    const course = createCourse({ name: '课', weekday: 1, startPeriod: 1, endPeriod: 1 });
    expect(() => exportScheduleIcal([course], { semesterStart: '2026-09-08' })).toThrow('周一');
    expect(() => exportScheduleIcal([course], { semesterStart: '2026-02-30' })).toThrow('周一');
  });

  test('RFC 5545 文本转义是稳定且可复用的', () => {
    expect(escapeIcalText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
});
