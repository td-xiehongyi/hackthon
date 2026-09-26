import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CloseGuard, LocateResult, NavigationTarget, PlaceId, PlacePanelProps } from '../shared/contracts';
import PixelIcon from '../shared/ui/PixelIcon';
import PageShell from './PageShell';
import { PLACES } from './campuses';
import { resolvePanel } from './placeRegistry';
import type { Route } from './router';

interface PlacePageProps {
  placeId: PlaceId;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}

/**
 * 地点功能页宿主（契约 §4.2）。
 * - 每次打开生成新的 sessionId；组件异步回调可据此丢弃过期结果。
 * - 组件可注册 CloseGuard，返回 false 时阻止关闭（例如表单未保存）。
 * - onLocate 当前地图未标定，统一返回 unmapped，不伪造坐标。
 */
export default function PlacePage({ placeId, onNavigate, onBack }: PlacePageProps) {
  const place = PLACES[placeId];
  const sessionId = useId();
  const guards = useRef(new Set<CloseGuard>());
  const [closing, setClosing] = useState(false);

  const registerCloseGuard = useCallback((guard: CloseGuard) => {
    guards.current.add(guard);
    return () => { guards.current.delete(guard); };
  }, []);

  const requestClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      for (const guard of guards.current) {
        if (!(await guard())) return;
      }
      onBack();
    } catch {
      // 守卫抛错按“不允许关闭”处理
    } finally {
      setClosing(false);
    }
  }, [closing, onBack]);

  const onLocate = useCallback(async (target: NavigationTarget): Promise<LocateResult> => {
    const label = target.kind === 'place' ? PLACES[target.placeId]?.identity.name : target.kind === 'building' ? target.buildingId : target.landmarkId;
    if (!label) return { status: 'unknown-target', message: '未登记的目标' };
    return { status: 'unmapped', message: `${label} 的地图坐标尚未标定` };
  }, []);

  // 功能页打开期间，Esc 等同请求关闭；与地图 E 键互不干扰（地图此时未挂载）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const Panel = resolvePanel(place.identity.featureKey);
  const panelProps: PlacePanelProps = {
    place: place.identity,
    sessionId,
    buildings: [],
    onRequestClose: () => { void requestClose(); },
    onLocate,
    registerCloseGuard,
  };

  return (
    <PageShell
      className="place-page"
      eyebrow={`${place.identity.featureKey.toUpperCase()} · 潇湘校区`}
      title={place.identity.name}
      backLabel="返回"
      onBack={() => { void requestClose(); }}
      onHome={() => onNavigate({ name: 'start' })}
      aside={
        <button type="button" className="back-button" onClick={() => onNavigate({ name: 'campus', campusId: 'xiaoxiang' })}>
          <PixelIcon name="pin" size={11} />
          潇湘校区
        </button>
      }
    >
      <div className="place-host" data-place-id={placeId} data-session-id={sessionId}>
        {Panel ? (
          <Suspense fallback={<div className="place-loading" role="status">正在打开{place.identity.name}…</div>}>
            <Panel {...panelProps} />
          </Suspense>
        ) : (
          <PlacePlaceholder placeId={placeId} onNavigate={onNavigate} />
        )}
      </div>
    </PageShell>
  );
}

/** 功能组件尚未接入时的占位页：说明该地点将提供什么、由谁交付，并给出去处。 */
function PlacePlaceholder({ placeId, onNavigate }: { placeId: PlaceId; onNavigate: (route: Route) => void }) {
  const place = PLACES[placeId];
  const others = (Object.keys(PLACES) as PlaceId[]).filter((id) => id !== placeId);
  return (
    <section className="place-placeholder">
      <div className="place-placeholder-copy">
        <span className="section-number">FEATURE · {place.owner} 组交付</span>
        <h2 className="panel-title">{place.identity.name}</h2>
        <p className="hero-lead">{place.summary}</p>
        <ul className="feature-list">
          {place.features.map((f) => (
            <li key={f}><PixelIcon name="check" size={10} />{f}</li>
          ))}
        </ul>
        <p className="field-note">
          功能页组件 <code>{place.identity.featureKey}</code> 尚未接入。{place.owner} 组交付后，在 <code>src/app/placeRegistry.ts</code> 登记即可在此显示。
        </p>
        <div className="hero-actions">
          <button type="button" className="pixel-button primary" onClick={() => onNavigate({ name: 'map' })}>
            <PixelIcon name="map" size={12} />
            回到地图
          </button>
        </div>
      </div>
      <aside className="place-siblings" aria-label="其他地点">
        <span className="section-number">其他可互动地点</span>
        {others.map((id) => (
          <button key={id} type="button" className="theme-option" onClick={() => onNavigate({ name: 'place', placeId: id })}>
            <span className="theme-text">
              <strong>{PLACES[id].identity.name}</strong>
              <small>{PLACES[id].summary}</small>
            </span>
            <PixelIcon name="arrow-right" size={10} />
          </button>
        ))}
      </aside>
    </section>
  );
}
