import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import DazeGame from './DazeGame';
import './LibraryPanel.css';

const CAMPUS_LABELS: Record<string, string> = {
  yuelushan: '岳麓山校区',
  lunan: '麓南校区',
  xiaoxiang: '潇湘校区',
};

export default function LibraryPanel({
  place,
  onRequestClose,
  registerCloseGuard,
}: PlacePanelProps) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'overview' | 'learn' | 'daze'>('overview');

  // 上传进行中注册关闭守卫，避免异步回调作用到已关闭的窗口。
  useEffect(() => {
    if (!busy) return;
    const unregister = registerCloseGuard(() => false);
    return unregister;
  }, [busy, registerCloseGuard]);

  return (
    <section className="library-panel" aria-label={place.name}>
      <header className="library-header">
        <div>
          <span className="library-eyebrow">图书馆 · LIBRARY</span>
          <h1>{place.name}</h1>
          <p className="library-campus">{CAMPUS_LABELS[place.campusId] ?? place.campusId}</p>
        </div>
        <button type="button" className="library-back" onClick={onRequestClose}>返回校园</button>
      </header>

      <nav className="library-tabs" aria-label="图书馆功能">
        <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>馆藏与相册</button>
        <button type="button" className={tab === 'learn' ? 'is-active' : ''} onClick={() => setTab('learn')}>学习 · Follow</button>
        <button type="button" className={tab === 'daze' ? 'is-active' : ''} onClick={() => setTab('daze')}>发呆 · 小游戏</button>
      </nav>

      {tab === 'overview' && <div className="library-info">
        <h2>地点介绍</h2>
        <p className="library-missing" role="status">简介内容缺失，待核验补充。</p>
        <h2>信息来源</h2>
        <p className="library-missing" role="status">来源信息缺失，待核验补充。</p>
      </div>}

      {tab === 'learn' && <section className="library-feature-card library-follow-card" aria-labelledby="follow-title">
        <div className="feature-mark" aria-hidden="true">↗</div>
        <div>
          <span className="library-eyebrow">学习工具 · FOLLOW</span>
          <h2 id="follow-title">把今天读到的，变成下一步。</h2>
          <p>Follow 是你的学习流：收藏课程、文章和灵感，按自己的节奏继续前进。</p>
          <a className="follow-launch" href="https://follow.is" target="_blank" rel="noreferrer">打开 Follow / Folo <span aria-hidden="true">↗</span></a>
        </div>
      </section>}

      {tab === 'daze' && <DazeGame />}

      {tab === 'overview' && <PlaceGallery placeId={place.placeId} onActivityChange={setBusy} />}
    </section>
  );
}
