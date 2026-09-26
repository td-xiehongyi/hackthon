import { useState } from 'react';
import MapViewport from '../game/MapViewport';
import StartScreen from './StartScreen';

type View = 'start' | 'map';

export default function App() {
  const [view, setView] = useState<View>('start');
  if (view === 'start') return <StartScreen onEnter={() => setView('map')} />;
  return (
    <main className="campus-app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <button type="button" className="back-button" onClick={() => setView('start')}>
          <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10"><path d="M8 1H6v2h2zM6 3H4v2h2zM4 5H2v2h2zM6 7H4v2h2zM8 9H6v2h2z" fill="currentColor" /></svg>
          返回首页
        </button>
        <span className="preview-label">地图预览</span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div>
            <span className="section-number">01 / CAMPUS MAP</span>
            <h2>从这里，<br />看见校园。</h2>
            <p className="intro">沿着道路与湖畔，浏览三个校区的像素风景。</p>
          </div>
          <div className="campus-list" aria-label="图中校区">
            <div><span>01</span>岳麓山校区</div>
            <div><span>02</span>麓南校区</div>
            <div><span>03</span>潇湘校区</div>
          </div>
          <div className="preview-note">
            <strong>当前可浏览地图</strong>
            <p>角色移动与地点交互待接入</p>
            <p>道路、碰撞和入口仍待标定。</p>
          </div>
          <a className="original-link" href="/maps/campus-final-v9.png" target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
        </aside>
        <MapViewport />
      </div>
    </main>
  );
}
