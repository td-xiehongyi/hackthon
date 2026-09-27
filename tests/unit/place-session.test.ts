import { describe, expect, test, vi } from 'vitest';
import { MAP_ID, type PlaceId } from '@/shared/contracts';
import { createSessionHost, type OpenContext } from '@/app/place-session';

/** 测试夹具：仅用于会话逻辑，不代表任何已标定坐标。 */
const FIXTURE: OpenContext = {
  placeId: 'xiaoxiang_library',
  entryPosition: { x: 100, y: 200 },
  facing: 'down',
  mapId: MAP_ID,
};

function open(host: ReturnType<typeof createSessionHost>, overrides: Partial<OpenContext> = {}) {
  return host.requestOpen({ ...FIXTURE, ...overrides });
}

describe('打开与输入锁', () => {
  test('打开后记录按 E 时的原触发位置与朝向', () => {
    const host = createSessionHost();
    const session = open(host);
    expect(session).not.toBeNull();
    expect(session?.entryPosition).toEqual({ x: 100, y: 200 });
    expect(session?.facing).toBe('down');
    expect(session?.mapId).toBe(MAP_ID);
    expect(host.isInputLocked()).toBe(true);
  });

  test('未注册的地点 ID 不创建会话', () => {
    const host = createSessionHost();
    expect(host.requestOpen({ ...FIXTURE, placeId: 'yuelushan_library' as PlaceId })).toBeNull();
    expect(host.current()).toBeNull();
    expect(host.isInputLocked()).toBe(false);
  });

  test('已有功能页时忽略重复打开请求，不叠加第二个页面', () => {
    const host = createSessionHost();
    const first = open(host);
    const second = open(host, { placeId: 'xiaoxiang_sports_ground' });
    expect(second?.sessionId).toBe(first?.sessionId);
    expect(host.current()?.placeId).toBe('xiaoxiang_library');
  });

  test('原触发位置按值保存，不被外部对象后续修改影响', () => {
    const host = createSessionHost();
    const context: OpenContext = { ...FIXTURE, entryPosition: { x: 1, y: 2 } };
    host.requestOpen(context);
    context.entryPosition.x = 999;
    expect(host.current()?.entryPosition).toEqual({ x: 1, y: 2 });
  });
});

describe('关闭检查（CloseGuard）', () => {
  test('全部检查通过才关闭，并释放输入锁', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    const order: string[] = [];
    host.registerCloseGuard(session.sessionId, () => {
      order.push('a');
      return true;
    });
    host.registerCloseGuard(session.sessionId, async () => {
      order.push('b');
      return true;
    });
    await expect(host.requestClose(session.sessionId)).resolves.toBe(true);
    expect(order).toEqual(['a', 'b']);
    expect(host.current()).toBeNull();
    expect(host.isInputLocked()).toBe(false);
  });

  test('任一检查返回 false 时保留功能页与输入锁', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    host.registerCloseGuard(session.sessionId, () => true);
    host.registerCloseGuard(session.sessionId, () => false);
    await expect(host.requestClose(session.sessionId)).resolves.toBe(false);
    expect(host.current()?.sessionId).toBe(session.sessionId);
    expect(host.isInputLocked()).toBe(true);
  });

  test('检查抛出异常时保留功能页并通知错误', async () => {
    const onCloseError = vi.fn();
    const host = createSessionHost({ onCloseError });
    const session = open(host)!;
    host.registerCloseGuard(session.sessionId, () => {
      throw new Error('boom');
    });
    await expect(host.requestClose(session.sessionId)).resolves.toBe(false);
    expect(host.current()).not.toBeNull();
    expect(onCloseError).toHaveBeenCalledTimes(1);
  });

  test('检查返回拒绝的 Promise 时保留功能页并通知错误', async () => {
    const onCloseError = vi.fn();
    const host = createSessionHost({ onCloseError });
    const session = open(host)!;
    host.registerCloseGuard(session.sessionId, () => Promise.reject(new Error('nope')));
    await expect(host.requestClose(session.sessionId)).resolves.toBe(false);
    expect(host.current()).not.toBeNull();
    expect(host.isInputLocked()).toBe(true);
    expect(onCloseError).toHaveBeenCalledTimes(1);
  });

  test('异步检查完成前保持输入锁', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    let release!: (value: boolean) => void;
    host.registerCloseGuard(session.sessionId, () => new Promise<boolean>((resolve) => {
      release = resolve;
    }));
    const pending = host.requestClose(session.sessionId);
    expect(host.isInputLocked()).toBe(true);
    release(true);
    await expect(pending).resolves.toBe(true);
    expect(host.isInputLocked()).toBe(false);
  });

  test('注销函数移除对应检查', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    const unregister = host.registerCloseGuard(session.sessionId, () => false);
    unregister();
    await expect(host.requestClose(session.sessionId)).resolves.toBe(true);
  });
});

describe('并发与失效会话', () => {
  test('重复关闭请求被合并，检查只执行一次', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    const guard = vi.fn(async () => true);
    host.registerCloseGuard(session.sessionId, guard);
    const [first, second] = await Promise.all([
      host.requestClose(session.sessionId),
      host.requestClose(session.sessionId),
    ]);
    expect(guard).toHaveBeenCalledTimes(1);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(host.current()).toBeNull();
  });

  test('已失效 sessionId 的迟到结果被忽略', async () => {
    const host = createSessionHost();
    const stale = open(host)!;
    await host.requestClose(stale.sessionId);
    const fresh = open(host, { placeId: 'xiaoxiang_sports_ground' })!;
    await expect(host.requestClose(stale.sessionId)).resolves.toBe(false);
    expect(host.current()?.sessionId).toBe(fresh.sessionId);
    expect(host.current()?.placeId).toBe('xiaoxiang_sports_ground');
  });

  test('异步检查期间会话被替换时，迟到结果不生效', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    let release!: (value: boolean) => void;
    host.registerCloseGuard(session.sessionId, () => new Promise<boolean>((resolve) => {
      release = resolve;
    }));
    const pending = host.requestClose(session.sessionId);
    // 关闭流程进行中，新的打开请求不应被接受。
    expect(open(host, { placeId: 'xiaoxiang_teaching_group' })?.sessionId).toBe(session.sessionId);
    release(true);
    await expect(pending).resolves.toBe(true);
    expect(host.current()).toBeNull();
  });

  test('失效 sessionId 的关闭检查不会被登记', async () => {
    const host = createSessionHost();
    const guard = vi.fn(() => false);
    host.registerCloseGuard('not-the-current-session', guard);
    const session = open(host)!;
    await expect(host.requestClose(session.sessionId)).resolves.toBe(true);
    expect(guard).not.toHaveBeenCalled();
  });

  test('取走的已关闭会话用于恢复原触发位置与朝向，且只取一次', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    await host.requestClose(session.sessionId);
    const closed = host.takeClosedSession();
    expect(closed?.entryPosition).toEqual({ x: 100, y: 200 });
    expect(closed?.facing).toBe('down');
    expect(host.takeClosedSession()).toBeNull();
  });

  test('关闭被阻止时不产生已关闭会话', async () => {
    const host = createSessionHost();
    const session = open(host)!;
    host.registerCloseGuard(session.sessionId, () => false);
    await host.requestClose(session.sessionId);
    expect(host.takeClosedSession()).toBeNull();
  });

  test('关闭后重新打开得到新的 sessionId', async () => {
    const host = createSessionHost();
    const first = open(host)!;
    await host.requestClose(first.sessionId);
    const second = open(host)!;
    expect(second.sessionId).not.toBe(first.sessionId);
  });
});

describe('订阅', () => {
  test('状态变化通知订阅者，退订后不再通知', async () => {
    const host = createSessionHost();
    const listener = vi.fn();
    const unsubscribe = host.subscribe(listener);
    const session = open(host)!;
    expect(listener).toHaveBeenCalled();
    const before = listener.mock.calls.length;
    unsubscribe();
    await host.requestClose(session.sessionId);
    expect(listener.mock.calls.length).toBe(before);
  });
});
