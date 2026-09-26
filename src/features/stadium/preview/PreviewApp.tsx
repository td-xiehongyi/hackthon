/**
 * 开发预览宿主（临时）。
 *
 * 在 A 落地 Panel 宿主与 dev preview 之前，用它独立查看 StadiumPanel 与 ContentEditor。
 * 接入 A 宿主后，本目录整体删除。所用 props 为开发替身，不代表真实地图会话。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PlaceIdentity } from '../types';
import { createMockPublicContentApi } from '../../content-editor/mockPublicContentApi';
import { sampleSnapshot } from './sample-data';
import StadiumPanel from '../StadiumPanel';
import ContentEditor from '../../content-editor/ContentEditor';
import './preview.css';

const PLACE: PlaceIdentity = {
  name: '潇湘校区体育场（副场）',
  campusId: 'xiaoxiang',
  placeId: 'xiaoxiang_sports_ground',
  featureKey: 'stadium',
};

export default function PreviewApp() {
  const api = useMemo(() => createMockPublicContentApi({ initial: sampleSnapshot(), latencyMs: 200 }), []);
  const [view, setView] = useState<'stadium' | 'editor'>('stadium');

  const closeGuard = useRef<(() => boolean | Promise<boolean>) | null>(null);
  const onRequestClose = async () => {
    if (closeGuard.current && !(await closeGuard.current())) return;
    setView('stadium');
  };
  const onLocate = async () => ({ status: 'unmapped', message: '开发预览：地图定位尚未接入' } as const);
  const registerCloseGuard = useCallback((guard: () => boolean | Promise<boolean>) => {
    closeGuard.current = guard;
    return () => { if (closeGuard.current === guard) closeGuard.current = null; };
  }, []);

  return (
    <div className="pv-root">
      <div className="pv-toolbar">
        <span className="pv-badge">开发预览 · 临时</span>
        <button className={view === 'stadium' ? 'is-active' : ''} onClick={() => setView('stadium')}>
          查询页（游客视角）
        </button>
        <button className={view === 'editor' ? 'is-active' : ''} onClick={() => setView('editor')}>
          内容编辑器（维护视角）
        </button>
      </div>

      {view === 'stadium' ? (
        <StadiumPanel
          place={PLACE}
          sessionId="preview-session"
          buildings={[]}
          api={api}
          onRequestClose={onRequestClose}
          onLocate={onLocate}
          registerCloseGuard={registerCloseGuard}
        />
      ) : (
        <ContentEditor api={api} onRequestClose={onRequestClose} registerCloseGuard={registerCloseGuard} />
      )}
    </div>
  );
}
