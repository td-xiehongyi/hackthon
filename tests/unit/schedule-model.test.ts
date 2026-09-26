import { describe, expect, test } from 'vitest';
import {
  courseOccursInWeek,
  createCourse,
  exportScheduleCsv,
  loadCourses,
  parseScheduleCsv,
  parseWeekExpression,
  saveCourses,
  type StorageLike,
} from '../../src/features/teaching/model';

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('课表周次与 WakeUp CSV', () => {
  test('可解析多段、单周和双周的混合周次', () => {
    expect(parseWeekExpression('1-5、7-11单、12-16双').weeks).toEqual([
      1, 2, 3, 4, 5, 7, 9, 11, 12, 14, 16,
    ]);
    expect(parseWeekExpression('第2至16周(双)').weeks).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });

  test('导入 WakeUp 七列格式并展开单周', () => {
    const preview = parseScheduleCsv([
      '课程名称,星期,开始节数,结束节数,老师,地点,周数',
      '大学物理,3,1,2,王老师,科教楼301,1-8单',
    ].join('\r\n'));

    expect(preview.status).toBe('ready');
    expect(preview.acceptedRows).toBe(1);
    expect(preview.courses[0]).toMatchObject({
      name: '大学物理',
      weekday: 3,
      startPeriod: 1,
      endPeriod: 2,
      weeks: [1, 3, 5, 7],
      location: '科教楼301',
    });
  });

  test('任一行出错时预览为 invalid，由调用方保持原课表', () => {
    const preview = parseScheduleCsv([
      '课程名称,星期,开始节数,结束节数,老师,地点,周数',
      '有效课程,1,1,2,陈老师,A101,1-4',
      '错误课程,9,3,2,陈老师,A102,0-4',
    ].join('\n'));

    expect(preview.status).toBe('invalid');
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.courses).toHaveLength(1);
  });
});

describe('个人课表保存与导出', () => {
  test('保存后可从同一浏览器存储恢复', () => {
    const storage = new MemoryStorage();
    const course = createCourse({
      name: '设计基础',
      teacher: '周老师',
      weekday: 4,
      startPeriod: 5,
      endPeriod: 6,
      weekExpression: '1-16',
      buildingName: '新校区教学楼',
      location: 'B203',
      tags: ['设计'],
    });

    expect(saveCourses([course], { storage }).status).toBe('saved');
    const loaded = loadCourses({ storage });
    expect(loaded.status).toBe('loaded');
    expect(loaded.courses[0].name).toBe('设计基础');
    expect(courseOccursInWeek(loaded.courses[0], 16)).toBe(true);
  });

  test('CSV 导出带 BOM 并防止表格公式注入', () => {
    const course = createCourse({
      name: '=HYPERLINK("bad")',
      weekday: 1,
      startPeriod: 1,
      weekExpression: '1-2',
    });
    const csv = exportScheduleCsv([course]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
  });
});
