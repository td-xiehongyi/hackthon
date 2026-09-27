import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import TimetableEditor from '../teaching/TimetableEditor';
import DazeGame from './DazeGame';
import './LibraryPanel.css';
import PlaceArtwork from '../../shared/PlaceArtwork';
import '../../shared/place-introduction.css';

// 馆情资料核对：https://lib.csu.edu.cn/gk/bgjs.htm

const CAMPUS_LABELS: Record<string, string> = {
  yuelushan: '岳麓山校区',
  lunan: '麓南校区',
  xiaoxiang: '潇湘校区',
};

export default function LibraryPanel({
  place,
  buildings,
  onRequestClose,
  registerCloseGuard,
}: PlacePanelProps) {
  const [busy, setBusy] = useState(false);
  const [timetableDirty, setTimetableDirty] = useState(false);
  const [activeTool, setActiveTool] = useState<'overview' | 'learning' | 'daze' | 'gallery'>('overview');
  const [learningView, setLearningView] = useState<'follow' | 'timetable'>('follow');

  // 上传进行中注册关闭守卫，避免异步回调作用到已关闭的窗口。
  useEffect(() => {
    if (!busy && !timetableDirty) return;
    const unregister = registerCloseGuard(() => !busy && !timetableDirty);
    return unregister;
  }, [busy, registerCloseGuard, timetableDirty]);

  return (
    <section className="library-panel" aria-label={place.name}>
      <header className="library-header">
        <div>
          <span className="library-eyebrow">图书馆 · LIBRARY</span>
          <h1>{place.name}</h1>
          <p className="library-campus">{CAMPUS_LABELS[place.campusId] ?? place.campusId}</p>
        </div>
        <PlaceArtwork kind="library" />
        <button type="button" className="library-back" onClick={onRequestClose}>返回校园</button>
      </header>

      <div className="library-info">
        <div className="library-tabs" role="tablist" aria-label="图书馆功能">
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'overview'}
            className={activeTool === 'overview' ? 'is-active' : ''}
            onClick={() => setActiveTool('overview')}
          >
            馆内信息
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'learning'}
            className={activeTool === 'learning' ? 'is-active' : ''}
            onClick={() => setActiveTool('learning')}
          >
            学习
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === 'daze'}
            className={activeTool === 'daze' ? 'is-active' : ''}
            onClick={() => setActiveTool('daze')}
          >
            发呆 · 小游戏
          </button>
          <button type="button" role="tab" aria-selected={activeTool === 'gallery'} className={activeTool === 'gallery' ? 'is-active' : ''} onClick={() => setActiveTool('gallery')}>地点相册</button>
        </div>

        {activeTool === 'overview' ? (
          <div role="tabpanel" className="library-overview place-introduction">
            <h2>地点介绍</h2>
            <p>潇湘校区图书馆是中南大学图书馆的馆舍之一，为师生提供阅读、自习和文献查阅空间，也是校园里的日常学习场所。</p>
            <h2>阅读与学习</h2>
            <p>中南大学图书馆的馆藏覆盖冶金、材料、地质、采矿、土木建筑、交通运输、医学等多个学科。纸质图书、电子期刊与学位论文等资源，为课程学习、课题研究和兴趣阅读提供支持。</p>
            <h2>从这里开始你的学习时光</h2>
            <p>在这里整理学习计划，打开「学习」查看课程安排或继续 Follow 订阅；想休息时，可以切换到「发呆 · 小游戏」，也可以在「地点相册」记录你的校园学习日常。</p>
          </div>
        ) : activeTool === 'learning' ? (
          <div role="tabpanel" className="library-learning">
            <div className="learning-tools" role="tablist" aria-label="学习工具">
              <button type="button" role="tab" aria-selected={learningView === 'follow'} className={learningView === 'follow' ? 'is-active' : ''} onClick={() => setLearningView('follow')}>Follow 订阅</button>
              <button type="button" role="tab" aria-selected={learningView === 'timetable'} className={learningView === 'timetable' ? 'is-active' : ''} onClick={() => setLearningView('timetable')}>我的课表</button>
            </div>
            {learningView === 'follow' ? <>
              <div className="learning-kicker">学习工作台</div>
              <h2>把想学的内容带进图书馆</h2>
              <p>用 Follow 订阅课程、研究主题和创作者更新，回到图书馆时继续你的阅读轨迹。</p>
              <a className="follow-launch" href="https://folo.is/" target="_blank" rel="noreferrer">
                <span className="follow-mark" aria-hidden="true">F</span>
                <span><strong>打开 Folo（Follow）</strong><small>在新标签页中管理你的学习订阅</small></span>
                <span className="follow-arrow" aria-hidden="true">↗</span>
              </a>
              <p className="learning-note">Folo（Follow）是外部学习工具，登录与订阅操作将在新标签页完成。</p>
            </> : <TimetableEditor buildings={buildings} onDirtyChange={setTimetableDirty} />}
          </div>
        ) : activeTool === 'daze' ? (
          <div role="tabpanel"><DazeGame /></div>
        ) : null}
      </div>

      <div className="place-album-panel" hidden={activeTool !== 'gallery'} role="tabpanel" aria-label="地点相册内容">
        <PlaceGallery placeId={place.placeId} onActivityChange={setBusy} />
      </div>
    </section>
  );
}
