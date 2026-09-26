import { describe, expect, test } from 'vitest';
import {
  CSU_CA_SCHEDULE_URL,
  openCsuSchedulePage,
  parseCaScheduleHtml,
  parseCaScheduleText,
  parseCsuSchedule,
} from '../../src/features/teaching/caImport';

describe('CSU CA 教务课表导入适配器', () => {
  test('识别 CA HTML 表格并映射合并的上课时间', () => {
    const html = `
      <html><body>
        <form><label>用户名</label><input value="should-not-be-read"><label>密码</label><input value="secret"></form>
        <table class="course-list">
          <tr><th>课程名称</th><th>上课星期</th><th>上课时间</th><th>任课教师</th><th>上课地点</th><th>教学周</th></tr>
          <tr><td>大学物理</td><td>星期三</td><td>第1-2节</td><td>王老师</td><td>科教楼301</td><td>1-8单</td></tr>
        </table>
      </body></html>`;
    const preview = parseCaScheduleHtml(html, { maxWeek: 16 });

    expect(preview.status).toBe('ready');
    expect(preview.source).toBe('html');
    expect(preview.detectedTableCount).toBe(1);
    expect(preview.acceptedRows).toBe(1);
    expect(preview.courses[0]).toMatchObject({
      name: '大学物理',
      weekday: 3,
      startPeriod: 1,
      endPeriod: 2,
      weeks: [1, 3, 5, 7],
      teacher: '王老师',
      location: '科教楼301',
    });
    // No credential/control value should leak into the parsed course data.
    expect(JSON.stringify(preview)).not.toContain('secret');
    expect(JSON.stringify(preview)).not.toContain('should-not-be-read');
  });

  test('保留被筛选表单包裹的课表表格，同时忽略表单控件', () => {
    const html = `
      <form>
        <label>用户名</label><input value="student@example.com">
        <table>
          <tr><th>课程名称</th><th>星期</th><th>节次</th><th>周次</th></tr>
          <tr><td>数据库系统</td><td>周二</td><td>3-4</td><td>1-16周</td></tr>
        </table>
      </form>`;
    const preview = parseCaScheduleHtml(html);

    expect(preview.status).toBe('ready');
    expect(preview.courses[0]).toMatchObject({ name: '数据库系统', weekday: 2, startPeriod: 3, endPeriod: 4 });
    expect(JSON.stringify(preview)).not.toContain('student@example.com');
  });

  test('支持从 CA 页面复制的 TSV 和教学周/单双周字段', () => {
    const tsv = [
      '课程\t星期\t节次\t老师\t教室\t周次',
      '线性代数\t周一\t3-4\t李老师\t新校区 A201\t2-16双',
    ].join('\n');
    const preview = parseCaScheduleText(tsv);

    expect(preview.status).toBe('ready');
    expect(preview.source).toBe('tsv');
    expect(preview.courses[0]).toMatchObject({
      name: '线性代数',
      weekday: 1,
      startPeriod: 3,
      endPeriod: 4,
      weeks: [2, 4, 6, 8, 10, 12, 14, 16],
      location: '新校区 A201',
    });
  });

  test('支持课程名称/上课时间键值块，并对未知页面给出可解释错误', () => {
    const labelled = [
      '课程名称：大学英语',
      '星期：周五',
      '上课时间：第5-6节',
      '老师：赵老师',
      '地点：外语楼202',
      '周次：1-16周',
    ].join('\n');
    const preview = parseCsuSchedule(labelled);
    expect(preview.status).toBe('ready');
    expect(preview.courses[0]).toMatchObject({ name: '大学英语', weekday: 5, startPeriod: 5, endPeriod: 6 });

    const invalid = parseCsuSchedule('欢迎登录教务系统\n暂无课表数据');
    expect(invalid.status).toBe('invalid');
    expect(invalid.errors[0].code).toBe('ca-no-schedule-table');
  });

  test('只打开官方 CA 地址，不附加账号、密码或查询参数', () => {
    let opened = '';
    expect(openCsuSchedulePage((url) => {
      opened = url;
      return { opened: true };
    })).toBe(true);
    expect(opened).toBe(CSU_CA_SCHEDULE_URL);
    expect(opened).not.toMatch(/[?&](?:user|username|password|pwd)=/i);
  });

  test('在没有浏览器窗口的运行环境中安全返回失败', () => {
    expect(openCsuSchedulePage()).toBe(false);
  });
});
