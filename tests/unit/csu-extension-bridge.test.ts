import { describe, expect, test } from 'vitest';
import { readCsuExtensionMessage } from '../../src/features/teaching/csuExtensionBridge';

describe('CSU 浏览器插件消息边界', () => {
  test('只接受同源、同窗口且带有课程的消息', () => {
    const source = {} as Window;
    const event = {
      origin: 'http://127.0.0.1:5173',
      source,
      data: {
        source: 'csu-browser-extension',
        type: 'CSU_SCHEDULE_CAPTURE',
        payload: {
          capturedAt: '2026-09-26T00:00:00.000Z',
          pageUrl: 'http://csujwc.its.csu.edu.cn/jsxsd/kbxx/toKbcx.do',
          courses: [{
            title: '课程名称：数据结构\n周次：1-16(周)\n节次：0304节\n星期：星期一\n上课地点：A201',
            cookie: 'must-not-cross-boundary',
          }],
        },
      },
    } as unknown as MessageEvent<unknown>;

    const message = readCsuExtensionMessage(event, 'http://127.0.0.1:5173', source);
    expect(message?.payload.courses).toHaveLength(1);
    expect(message?.payload.courses[0]).not.toHaveProperty('cookie');
  });

  test('拒绝伪造来源、空课表和超大消息', () => {
    const source = {} as Window;
    const base = {
      source: 'csu-browser-extension',
      type: 'CSU_SCHEDULE_CAPTURE',
      payload: { courses: [{ title: '课程名称：数学' }] },
    };
    const makeEvent = (data: unknown, origin = 'http://127.0.0.1:5173') => ({ origin, source, data } as unknown as MessageEvent<unknown>);

    expect(readCsuExtensionMessage(makeEvent({ ...base, source: 'other' }), 'http://127.0.0.1:5173', source)).toBeNull();
    expect(readCsuExtensionMessage(makeEvent({ ...base, payload: { courses: [] } }), 'http://127.0.0.1:5173', source)).toBeNull();
    expect(readCsuExtensionMessage(makeEvent(base, 'https://evil.example'), 'http://127.0.0.1:5173', source)).toBeNull();
    expect(readCsuExtensionMessage(makeEvent({ ...base, payload: { courses: [{ title: 'x'.repeat(2_100_000) }] } }), 'http://127.0.0.1:5173', source)).toBeNull();
  });
});
