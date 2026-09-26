import { describe, expect, it } from 'vitest';
import { coursesToCsv, normalizeSnapshot, parseCoursesCsv } from '../../../src/features/teaching/domain';

const snapshot = {
  schemaVersion: 1 as const,
  semester: '2026–2027 第一学期',
  courses: [{
    id: 'c1', title: '大学生心理健康教育', teacher: '李老师', weekday: 1,
    startPeriod: 1, endPeriod: 2, weeks: '1–16', parity: 'all' as const,
    buildingId: '', location: '教务系统原文', room: 'A203',
  }],
};

describe('个人课表 CSV', () => {
  it('导出并重新导入时保留星期和起止节次', () => {
    const parsed = parseCoursesCsv(coursesToCsv(snapshot));
    expect(parsed.errors).toEqual([]);
    expect(parsed.courses[0]).toMatchObject({ weekday: 1, startPeriod: 1, endPeriod: 2, room: 'A203' });
  });

  it('错误行不会生成课程，并返回可读错误', () => {
    const parsed = parseCoursesCsv('课程名称,教师,星期,起始节,结束节\n,,,,' );
    expect(parsed.courses).toHaveLength(0);
    expect(parsed.errors[0]).toContain('第 2 行');
  });

  it('拒绝超出 12 节的节次，不静默截断', () => {
    const parsed = parseCoursesCsv('课程名称,教师,星期,起始节,结束节\n数学,,星期一,99,100');
    expect(parsed.courses).toHaveLength(0);
    expect(parsed.errors).toHaveLength(1);
  });

  it('兼容早期单节 period 数据并规范化快照', () => {
    const result = normalizeSnapshot({ courses: [{ id: 'legacy', title: '旧课', weekday: 0, period: 2 }] });
    expect(result.courses[0]).toMatchObject({ startPeriod: 2, endPeriod: 2 });
  });
});
