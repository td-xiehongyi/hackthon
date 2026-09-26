import { useCallback, useEffect, useState } from 'react';
import TeachingPage from '../features/teaching/TeachingPage';
import MapViewport from '../game/MapViewport';

export default function App() {
  const [page, setPage] = useState<'campus' | 'teaching'>(() => window.location.hash === '#teaching' ? 'teaching' : 'campus');
  const openTeaching = useCallback(() => {
    if (window.location.hash !== '#teaching') {
      window.history.pushState({ csuView: 'teaching' }, '', '#teaching');
    }
    setPage('teaching');
  }, []);
  const returnToCampus = useCallback(() => {
    if (window.history.state?.csuView === 'teaching') {
      window.history.back();
      return;
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    setPage('campus');
  }, []);

  useEffect(() => {
    const handleHistory = () => setPage(window.location.hash === '#teaching' ? 'teaching' : 'campus');
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);

  return (
    <>
    <main className="campus-app" hidden={page !== 'campus'}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <span className="preview-label">校园地图</span>
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
            <strong>教学楼群已开放</strong>
            <p>在地图南部找到“课”标记</p>
            <button type="button" onClick={openTeaching}>进入课表与蹭课中心</button>
          </div>
          <a className="original-link" href="/maps/campus-final-v9.png" target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
        </aside>
        <MapViewport active={page === 'campus'} onOpenTeaching={openTeaching} />
      </div>
    </main>
    {page === 'teaching' && <TeachingPage onBack={returnToCampus} />}
    </>
  );
}
