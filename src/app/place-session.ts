/**
 * 地点功能页会话与输入锁。
 *
 * 宿主职责（docs/02 第 5 节）：
 * - 校验地点 ID、当前目标有效性与功能页状态；已有功能页时忽略重复打开请求。
 * - 打开前保存按 E 时的原触发位置与朝向，生成本次 sessionId，停止角色移动、清除按键状态并取得唯一输入锁。
 * - 关闭时先通过全部 CloseGuard，再恢复原触发位置与朝向、清空按键、释放锁。
 * - 忽略已失效 sessionId 的迟到回调；合并同一会话中的重复关闭请求。
 *
 * 本模块不依赖 React 或 Phaser，便于单元测试。状态全部保存在闭包内，
 * 不同宿主实例（含测试用例）之间互不影响。
 */

import type { Direction, PlaceId, PlaceSession, Point } from '../shared/contracts';
import { getPlace } from '../shared/place-registry';

export interface OpenContext {
  placeId: PlaceId;
  /** 按 E 时的角色脚底中心位置。 */
  entryPosition: Point;
  /** 按 E 时的朝向。 */
  facing: Direction;
  /** 按 E 时的地图会话标识。 */
  mapId: PlaceSession['mapId'];
}

export interface SessionHost {
  /** 当前打开的地点会话；未打开时为 null。 */
  current(): PlaceSession | null;
  /** 角色移动是否应暂停（功能页打开或关闭检查进行中）。 */
  isInputLocked(): boolean;
  /**
   * 请求打开功能页。已有功能页或地点 ID 未注册时返回当前会话（可能为 null），
   * 不叠加第二个地点功能页。
   */
  requestOpen(context: OpenContext): PlaceSession | null;
  /**
   * 请求关闭功能页，返回是否真的关闭。
   * 已失效 sessionId、重复关闭请求、被 CloseGuard 阻止时返回 false。
   */
  requestClose(sessionId: string): Promise<boolean>;
  /** 登记关闭检查，返回注销函数。关闭检查未通过时功能页与输入锁继续保留。 */
  registerCloseGuard(sessionId: string, guard: () => boolean | Promise<boolean>): () => void;
  /** 取走最近一次成功关闭的会话上下文，用于恢复原触发位置与朝向。 */
  takeClosedSession(): PlaceSession | null;
  /** 订阅状态变化，返回退订函数。 */
  subscribe(listener: () => void): () => void;
}

/**
 * CloseGuard 语义（docs/02 第 5.2 节）：
 * - 返回 true 允许退出；返回 false 保留功能页与输入锁。
 * - 抛出异常或 Promise 拒绝时保留功能页并提示错误。
 * - 多个检查必须全部通过。
 * - 异步检查完成前保持输入锁。
 */
type GuardOutcome = 'allowed' | 'blocked' | 'failed';

async function evaluateGuard(guard: () => boolean | Promise<boolean>): Promise<GuardOutcome> {
  try {
    return (await guard()) ? 'allowed' : 'blocked';
  } catch {
    return 'failed';
  }
}

export interface SessionHostOptions {
  /** 关闭检查执行失败时的通知回调。 */
  onCloseError?: (error: unknown) => void;
}

export function createSessionHost(options: SessionHostOptions = {}): SessionHost {
  let session: PlaceSession | null = null;
  let closing = false;
  let closed: PlaceSession | null = null;
  let nextGuardId = 0;
  let activeGuards = new Map<number, () => boolean | Promise<boolean>>();
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    current: () => session,

    isInputLocked: () => session !== null || closing,

    requestOpen(context: OpenContext): PlaceSession | null {
      // 已有功能页时忽略重复打开请求；未注册的地点 ID 不被接受。
      if (session || !getPlace(context.placeId)) return session;
      session = {
        sessionId: createSessionId(),
        placeId: context.placeId,
        mapId: context.mapId,
        entryPosition: { x: context.entryPosition.x, y: context.entryPosition.y },
        facing: context.facing,
      };
      closing = false;
      closed = null;
      activeGuards = new Map();
      notify();
      return session;
    },

    async requestClose(sessionId: string): Promise<boolean> {
      // 忽略已失效 sessionId 的迟到结果。
      if (!session || session.sessionId !== sessionId) return false;
      // 合并同一会话中的重复关闭请求：已在关闭流程中时不再重复执行检查。
      if (closing) return false;
      closing = true;
      notify();
      try {
        for (const guard of [...activeGuards.values()]) {
          const outcome = await evaluateGuard(guard);
          // 异步检查期间会话被替换：迟到结果不再生效。
          if (session?.sessionId !== sessionId) return false;
          if (outcome === 'blocked') return false;
          if (outcome === 'failed') {
            options.onCloseError?.(new Error('关闭检查执行失败，已保留当前页面'));
            return false;
          }
        }
        closed = session;
        session = null;
        activeGuards = new Map();
        notify();
        return true;
      } finally {
        closing = false;
        // 会话已关闭时 notify 已在上面触发；仍保留一次以同步 isInputLocked 变化。
        notify();
      }
    },

    registerCloseGuard(sessionId: string, guard) {
      const id = nextGuardId++;
      // 只为当前有效会话登记检查；失效 sessionId 不保留回调。
      if (session?.sessionId === sessionId) activeGuards.set(id, guard);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        activeGuards.delete(id);
      };
    },

    takeClosedSession() {
      const value = closed;
      closed = null;
      return value;
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let sessionCounter = 0;

function createSessionId(): string {
  sessionCounter += 1;
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `place-${sessionCounter}-${random}`;
}
