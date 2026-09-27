import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..', '..');
const extractorPath = resolve(projectRoot, 'tools/csu-schedule-extension/console-extractor.js');
const source = readFileSync(extractorPath, 'utf8');
const API_KEY = '__CSU_SCHEDULE_CONSOLE_EXTRACTOR__';

type ExtractorApi = {
  version: number;
  source: string;
  buildCsv: (payload: unknown) => string;
};

const evaluate = (): ExtractorApi => {
  const context = createContext({ console: { info() {}, table() {} } });
  runInContext(source, context);
  return context[API_KEY] as ExtractorApi;
};

describe('CSU DevTools Console 提取器', () => {
  test('脚本保持为可直接粘贴执行的单文件，并不包含网络/凭据读取路径', () => {
    expect(source).toContain("(() => {");
    expect(source).toContain('querySelectorAll');
    expect(source).toContain('downloadCsv');
    expect(source).not.toMatch(/fetch\s*\(|XMLHttpRequest|document\.cookie|localStorage|sessionStorage/);
  });

  test('与扩展下载格式一致地生成 BOM CSV、单双周并防公式注入', () => {
    const api = evaluate();
    expect(api.version).toBe(1);
    expect(api.source).toBe('csu-console-extractor');
    const csv = api.buildCsv({
      capturedAt: '2026-09-26T17:39:53.000Z',
      courses: [{
        name: '=HYPERLINK("bad")', teacher: '张老师', weekday: 1,
        startPeriod: 1, endPeriod: 2, weeks: '1-8', weekParity: 'odd',
        location: '科教楼,301', tags: ['数学', '基础'],
      }],
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('课程名称,星期,开始节数,结束节数,老师,地点,周数,兴趣标签\r\n');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('星期一,1,2,张老师,"科教楼,301",1-8单,数学|基础');
  });
});
