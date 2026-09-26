/**
 * 地点功能页宿主。
 *
 * 职责（docs/02 第 5 节）：
 * - 校验打开请求的地点 ID、当前目标有效性与功能页状态；已有功能页时忽略重复请求。
 * - 打开前保存按 E 时的原触发位置与朝向、生成 sessionId、停止角色移动、清键、取唯一输入锁。
 * - 通过 PlacePanelProps 的六个入参向功能页提供协作接口。
 * - 功能页结束后才释放输入锁，不在点击返回按钮的一刻提前解锁。
 *
 * 功能模块不得直接访问或修改 Phaser 场景、镜头、角色、按键或碰撞体。
 * 打开上下文只能由地图侧通过明确参数传入，不使用全局变量或自建事件通道。
 *
 * 本组件是单一实例：功能页打开时用功能页替换 children（地图探索页），
 * 关闭后恢复 children，因此地图 DOM 不会被重建。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  LocateResult,
  NavigationTarget,
  PlacePanelProps,
} from '../shared/contracts';
import { getPlace, TEACHING_BUILDINGS } from '../shared/place-registry';
import { createSessionHost, type OpenContext, type SessionHost } from './place-session';
import type { ComponentType } from 'react';
import type { FeatureKey } from '../shared/contracts';
import LibraryPanel from '../features/library/LibraryPanel';
import PlaceholderPanel from './PlaceholderPanel';

/** 按 featureKey 选择功能页组件；教学楼群（B）与体育场副场（C）尚未交付，暂用占位页。 */
const PANELS: Record<FeatureKey, ComponentType<PlacePanelProps>> = {
  library: LibraryPanel,
  teaching: PlaceholderPanel,
  stadium: PlaceholderPanel,
};

export interface PlaceHostHandle {
  /** 由地图桥接调用：宿主再次校验并决定是否打开功能页。 */
  requestOpen(context: OpenContext): void;
}

interface PlaceHostProps {
  /** 地图探索页内容；功能页打开时被替换，关闭后恢复。 */
  children: ReactNode;
  /** 打开前的地图侧准备：暂停移动并清除按键状态。 */
  onSuspendMap: () => void;
  /** 关闭后的地图侧恢复：恢复原触发位置与朝向并清除按键状态。 */
  onResumeMap: (context: OpenContext) => void;
  /** 暴露宿主句柄给地图侧，避免功能模块自建事件通道。 */
  registerHandle: (handle: PlaceHostHandle | null) => void;
  /** 当前打开的功能页发生变化时通知外层。 */
  onOpenChange?: (open: boolean) => void;
}

export default function PlaceHost({
  children,
  onSuspendMap,
  onResumeMap,
  registerHandle,
  onOpenChange,
}: PlaceHostProps) {
  const hostRef = useRef<SessionHost | null>(null);
  const [session, setSession] = useState<ReturnType<SessionHost['current']>>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  if (!hostRef.current) {
    hostRef.current = createSessionHost({
      onCloseError: () => setCloseError('关闭检查执行失败，已保留当前页面。'),
    });
  }
  const host = hostRef.current;

  useEffect(() => host.subscribe(() => setSession(host.current())), [host]);

  useEffect(() => {
    onOpenChange?.(session !== null);
  }, [session, onOpenChange]);

  const requestOpen = useCallback(
    (context: OpenContext) => {
      // 未注册的地点 ID 不被接受；已有功能页时忽略重复打开请求。
      if (!getPlace(context.placeId)) return;
      if (host.current()) return;
      onSuspendMap();
      if (!host.requestOpen(context)) onResumeMap(context);
    },
    [host, onResumeMap, onSuspendMap],
  );

  useEffect(() => {
    registerHandle({ requestOpen });
    return () => registerHandle(null);
  }, [registerHandle, requestOpen]);

  const handleRequestClose = useCallback(
    (sessionId: string) => {
      void host.requestClose(sessionId).then((closed) => {
        if (!closed) return;
        const closedSession = host.takeClosedSession();
        if (!closedSession) return;
        onResumeMap({
          placeId: closedSession.placeId,
          entryPosition: closedSession.entryPosition,
          facing: closedSession.facing,
          mapId: closedSession.mapId,
        });
      });
    },
    [host, onResumeMap],
  );

  const onLocate = useCallback(async (target: NavigationTarget): Promise<LocateResult> => {
    switch (target.kind) {
      case 'place':
        return getPlace(target.placeId)
          ? { status: 'unmapped', message: '该地点的入口位置尚未标定。' }
          : { status: 'unknown-target', message: '未登记的地点 ID。' };
      case 'building':
        return TEACHING_BUILDINGS.some((building) => building.id === target.buildingId)
          ? { status: 'unmapped', message: '该楼座尚未建立地图定位。' }
          : { status: 'unknown-target', message: '未登记的楼座 ID。' };
      default:
        return { status: 'unknown-target', message: '未登记的地标 ID。' };
    }
  }, []);

  const panelProps = useMemo<PlacePanelProps | null>(() => {
    if (!session) return null;
    const place = getPlace(session.placeId);
    if (!place) return null;
    return {
      place,
      sessionId: session.sessionId,
      buildings: TEACHING_BUILDINGS,
      onRequestClose: () => handleRequestClose(session.sessionId),
      onLocate,
      registerCloseGuard: (guard) => host.registerCloseGuard(session.sessionId, guard),
    };
  }, [session, host, handleRequestClose, onLocate]);

  return (
    <>
      {children}
      {panelProps && (
        <div className="workspace workspace-single">
          {closeError && <p className="place-error" role="alert">{closeError}</p>}
          {(() => {
            const Panel = PANELS[panelProps.place.featureKey];
            return <Panel key={panelProps.sessionId} {...panelProps} />;
          })()}
        </div>
      )}
    </>
  );
}
