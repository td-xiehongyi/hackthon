import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import TimetableEditor from '../teaching/TimetableEditor';
import DazeGame from './DazeGame';
import './LibraryPanel.css';

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
  const [activeTool, setActiveTool] = useState<'overview' | 'learning' | 'daze'>('overview');
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
        </div>

        {activeTool === 'overview' ? (
          <div role="tabpanel" className="library-overview">
            <h2>地点介绍</h2>
            <p className="library-missing" role="status">简介内容缺失，待核验补充。</p>
            <h2>信息来源</h2>
            <p className="library-missing" role="status">来源信息缺失，待核验补充。</p>
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
        ) : (
          <div role="tabpanel"><DazeGame /></div>
        )}
      </div>

      <PlaceGallery placeId={place.placeId} onActivityChange={setBusy} />
    </section>
  );
}
