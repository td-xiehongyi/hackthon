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
 * 本组件是单一实例：正式探索页保留地图与信息栏，在其上打开地点浮层。
 * 地图保持挂载并暂停输入，关闭浮层后恢复原位。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  LocateResult,
  NavigationTarget,
  PlacePanelProps,
  MapAnnotation,
} from '../shared/contracts';
import { getPlace, TEACHING_BUILDINGS } from '../shared/place-registry';
import { createSessionHost, type OpenContext, type SessionHost } from './place-session';
import type { ComponentType } from 'react';
import type { FeatureKey } from '../shared/contracts';
import LibraryPanel from '../features/library/LibraryPanel';
import TeachingPlacePage from './TeachingPlacePage';
import StadiumPage from './StadiumPage';
import CanteenPanel from '../features/canteen/CanteenPanel';
import DormitoryPage from '../features/dormitory/DormitoryPage';
import NavigationOverview from './NavigationOverview';
import { resolveNavigation, type NavigationResolution } from '@/game/map-data';
import type { CharacterChoice } from '@/game/character/choices';

/** 地点共用会话、暂停与原位返回流程。 */
const PANELS: Record<FeatureKey, ComponentType<PlacePanelProps>> = {
  library: LibraryPanel,
  teaching: TeachingPlacePage,
  stadium: StadiumPage,
  canteen: CanteenPanel,
  dormitory: ({ onRequestClose }) => <DormitoryPage onBack={onRequestClose} />,
};

export interface PlaceHostHandle {
  /** 由地图桥接调用：宿主再次校验并决定是否打开功能页。 */
  requestOpen(context: OpenContext): void;
}

interface PlaceHostProps {
  characterChoice?: CharacterChoice;
  /** 开发测试场景可注入协议演示面板。正式地图使用默认业务页面。 */
  panelOverrides?: Partial<Record<FeatureKey, ComponentType<PlacePanelProps>>>;
  /** 地图探索页内容；正式入口在功能页打开期间保持可见。 */
  children: ReactNode;
  /** 打开前的地图侧准备：暂停移动并清除按键状态。 */
  onSuspendMap: () => void;
  /** 关闭后的地图侧恢复：恢复原触发位置与朝向并清除按键状态。 */
  onResumeMap: (context: OpenContext) => void;
  /** 暴露宿主句柄给地图侧，避免功能模块自建事件通道。 */
  registerHandle: (handle: PlaceHostHandle | null) => void;
  /** 当前打开的功能页发生变化时通知外层。 */
  onOpenChange?: (open: boolean) => void;
  validateOpen: (context: OpenContext) => boolean;
  annotation?: MapAnnotation | null;
}

export default function PlaceHost({
  children,
  onSuspendMap,
  onResumeMap,
  registerHandle,
  onOpenChange,
  validateOpen,
  annotation = null,
  panelOverrides,
  characterChoice,
}: PlaceHostProps) {
  const hostRef = useRef<SessionHost | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<ReturnType<SessionHost['current']>>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [marker, setMarker] = useState<Extract<NavigationResolution, { status: 'marked' }> | null>(null);

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

  useEffect(() => { if (session) panelRef.current?.focus(); }, [session?.sessionId]);

  const requestOpen = useCallback(
    (context: OpenContext) => {
      // 未注册的地点 ID 不被接受；已有功能页时忽略重复打开请求。
      if (!getPlace(context.placeId) || !validateOpen(context)) return;
      if (host.current()) return;
      setCloseError(null);
      onSuspendMap();
      if (!host.requestOpen(context)) onResumeMap(context);
    },
    [host, onResumeMap, onSuspendMap, validateOpen],
  );

  useEffect(() => {
    registerHandle({ requestOpen });
    return () => registerHandle(null);
  }, [registerHandle, requestOpen]);

  const handleRequestClose = useCallback(
    (sessionId: string) => {
      void host.requestClose(sessionId).then((closed) => {
        if (!closed) { if (host.current()?.sessionId === sessionId) setCloseError('页面暂不能关闭，请先完成上传或处理未保存修改。'); return; }
        setMarker(null);
        setCloseError(null);
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

  const onLocate = useCallback(async (sessionId: string, target: NavigationTarget): Promise<LocateResult> => {
    if (host.current()?.sessionId !== sessionId) return { status: 'unknown-target', message: '页面会话已关闭。' };
    const result = resolveNavigation(annotation, target);
    if (result.status === 'marked') setMarker(result);
    return result.status === 'marked' ? { status: 'marked' } : result;
  }, [annotation, host]);

  const panelProps = useMemo<PlacePanelProps | null>(() => {
    if (!session) return null;
    const place = getPlace(session.placeId);
    if (!place) return null;
    return {
      place,
      sessionId: session.sessionId,
      buildings: annotation?.buildings ?? TEACHING_BUILDINGS,
      onRequestClose: () => handleRequestClose(session.sessionId),
      onLocate: (target) => onLocate(session.sessionId, target),
      registerCloseGuard: (guard) => host.registerCloseGuard(session.sessionId, guard),
    };
  }, [session, host, handleRequestClose, onLocate, annotation]);

  return (
    <>
      {children}
      {marker && session && <NavigationOverview marker={marker} annotation={annotation} onClose={() => setMarker(null)} />}
      {panelProps && (
        <div ref={panelRef} className="workspace workspace-single place-overlay" tabIndex={-1} role="region" aria-label="地点功能面板">
          {closeError && <p className="place-error" role="alert">{closeError}</p>}
          {(() => {
            const Panel = panelOverrides?.[panelProps.place.featureKey] ?? PANELS[panelProps.place.featureKey];
            if (panelProps.place.featureKey === 'stadium' && !panelOverrides?.stadium) {
              return <StadiumPage key={panelProps.sessionId} {...panelProps} characterChoice={characterChoice} />;
            }
            return <Panel key={panelProps.sessionId} {...panelProps} />;
          })()}
        </div>
      )}
    </>
  );
}
