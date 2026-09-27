import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '..', '..');
const extensionRoot = resolve(projectRoot, 'tools/csu-schedule-extension');
const backgroundSource = readFileSync(resolve(extensionRoot, 'background.js'), 'utf8');

const evaluateBackground = <Result>(expression: string, values: Record<string, unknown> = {}): Result =>
  runInNewContext(`${backgroundSource}\n(${expression});`, {
    chrome: { runtime: { onMessage: { addListener() {} } } },
    TextEncoder,
    btoa: (binary: string) => Buffer.from(binary, 'binary').toString('base64'),
    ...values,
  }) as Result;

describe('CSU 扩展一键下载 CSV', () => {
  const payload = {
    capturedAt: '2026-09-26T17:39:53.000Z',
    courses: [{
      name: '=HYPERLINK("bad")',
      teacher: '张老师',
      weekday: 1,
      startPeriod: 1,
      endPeriod: 2,
      weeks: '1-8',
      weekParity: 'odd',
      location: '科教楼,301',
      tags: ['数学', '基础'],
    }],
  };

  test('生成带 BOM 的 WakeUp 兼容八列 CSV 并保留单双周', () => {
    const csv = evaluateBackground<string>('buildScheduleCsv(payload)', { payload });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('课程名称,星期,开始节数,结束节数,老师,地点,周数,兴趣标签\r\n');
    expect(csv).toContain('星期一,1,2,张老师,"科教楼,301",1-8单,数学|基础');
    expect(csv).toContain("'=HYPERLINK");
  });

  test('生成稳定文件名和可还原的下载 data URL', () => {
    const result = evaluateBackground<{ filename: string; csv: string; url: string }>(`(() => {
      const csv = buildScheduleCsv(payload);
      return { filename: scheduleDownloadFilename(payload), csv, url: scheduleCsvDataUrl(csv) };
    })()`, { payload });
    expect(result.filename).toBe('CSU课表-20260926-173953Z.csv');
    const { csv, url } = result;
    expect(url.startsWith('data:text/csv;charset=utf-8;base64,')).toBe(true);
    const decoded = Buffer.from(url.split(',')[1], 'base64').toString('utf8');
    expect(decoded).toBe(csv);
  });

  test('Manifest 启用 MV3 后台下载权限和自动下载弹窗', () => {
    const manifest = JSON.parse(readFileSync(resolve(extensionRoot, 'manifest.json'), 'utf8')) as {
      version: string;
      permissions: string[];
      background: { type?: string };
    };
    const popup = readFileSync(resolve(extensionRoot, 'popup.js'), 'utf8');
    expect(manifest.version).toBe('0.2.0');
    expect(manifest.permissions).toContain('downloads');
    expect(manifest.background.type).toBe('module');
    expect(popup).toContain('await runCapture()');
  });

  test('工具栏一次点击会缓存、下载并转发同一份课表', async () => {
    const listeners: Array<(
      message: { type: string },
      sender: { tab?: { id?: number; url?: string } },
      sendResponse: (value: Record<string, unknown>) => void,
    ) => boolean | undefined> = [];
    const stored: Record<string, unknown> = {};
    const downloads: Array<{ url: string; filename: string }> = [];
    const forwarded: Array<{ tabId: number; message: { type: string } }> = [];
    const capturedPayload = {
      source: 'csu-browser-extension',
      capturedAt: '2026-09-26T17:39:53.000Z',
      courses: [{
        id: 'c1', name: '数据结构', teacher: '刘老师', weekday: 2,
        startPeriod: 3, endPeriod: 4, weeks: '1-16', weekParity: 'all', location: 'A201',
      }],
    };
    const chromeMock = {
      runtime: {
        lastError: undefined,
        onMessage: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) },
      },
      storage: {
        session: {
          set: async (value: Record<string, unknown>) => { Object.assign(stored, value); },
          get: async (key: string) => ({ [key]: stored[key] }),
          remove: async (key: string) => { delete stored[key]; },
        },
      },
      tabs: {
        query: async (query: { active?: boolean }) => query.active
          ? [{ id: 10, url: 'https://csujwc.its.csu.edu.cn/jsxsd/framework/xsMain.jsp' }]
          : [{ id: 20, url: 'http://127.0.0.1:5173/#teaching' }],
        sendMessage: (
          tabId: number,
          message: { type: string },
          callback?: (value: Record<string, unknown>) => void,
        ) => {
          if (message.type === 'CSU_CAPTURE_NOW') {
            callback?.({ ok: true, payload: capturedPayload });
            return undefined;
          }
          forwarded.push({ tabId, message });
          return Promise.resolve();
        },
      },
      downloads: {
        download: (options: { url: string; filename: string }, callback: (id: number) => void) => {
          downloads.push(options);
          callback(42);
        },
      },
    };
    runInNewContext(backgroundSource, {
      chrome: chromeMock,
      TextEncoder,
      btoa: (binary: string) => Buffer.from(binary, 'binary').toString('base64'),
    });
    expect(listeners).toHaveLength(1);

    const response = await new Promise<Record<string, unknown>>((resolveResponse) => {
      const keepChannelOpen = listeners[0]({ type: 'CSU_CAPTURE_ACTIVE' }, {}, resolveResponse);
      expect(keepChannelOpen).toBe(true);
    });

    expect(response).toMatchObject({ ok: true, downloaded: true, cached: true, delivered: 1, courseCount: 1 });
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe('CSU课表-20260926-173953Z.csv');
    expect(downloads[0].url).toMatch(/^data:text\/csv;charset=utf-8;base64,/);
    expect(forwarded).toEqual([{ tabId: 20, message: { type: 'CSU_SCHEDULE_CAPTURED', payload: expect.any(Object) } }]);
    expect(stored.latestCsuScheduleCapture).toMatchObject({ courses: [expect.objectContaining({ name: '数据结构' })] });
  });
});
