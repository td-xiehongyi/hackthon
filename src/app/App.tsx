import { useCallback, useEffect, useState } from 'react';
import TeachingPage from '../features/teaching/TeachingPage';
import MapViewport from '../game/MapViewport';
import TimetableEditor from '../features/teaching/TimetableEditor';
import DormitoryPage from '../features/dormitory/DormitoryPage';

export default function App() {
  const [page, setPage] = useState<'campus' | 'teaching' | 'dormitory'>(() => {
    if (window.location.hash === '#teaching') return 'teaching';
    if (window.location.hash === '#dormitory') return 'dormitory';
    return 'campus';
  });
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

  const openDormitory = useCallback(() => {
    if (window.location.hash !== '#dormitory') {
      window.history.pushState({ csuView: 'dormitory' }, '', '#dormitory');
    }
    setPage('dormitory');
  }, []);

  const returnFromDormitory = useCallback(() => {
    if (window.history.state?.csuView === 'dormitory') {
      window.history.back();
      return;
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    setPage('campus');
  }, []);

  useEffect(() => {
    const handleHistory = () => {
      if (window.location.hash === '#teaching') setPage('teaching');
      else if (window.location.hash === '#dormitory') setPage('dormitory');
      else setPage('campus');
    };
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [timetableDirty, setTimetableDirty] = useState(false);

  const closeTimetable = useCallback(() => {
    if (timetableDirty && !window.confirm('课表表单还有未保存内容，确定关闭吗？')) return;
    setTimetableOpen(false);
  }, [timetableDirty]);

  useEffect(() => {
    if (!timetableOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTimetable();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [timetableOpen, closeTimetable]);

  const openQuickTimetable = useCallback(() => {
    setTimetableOpen(true);
  }, []);

  return (
    <>
    <main className="campus-app" hidden={page !== 'campus'}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <span className="preview-label">校园地图</span>
        <button type="button" className="timetable-trigger" onClick={openQuickTimetable}>快速录入课表</button>
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
            <strong>教学楼群已开放 · 升华公寓群聊</strong>
            <p>教学楼群与升华公寓群聊已开放</p>
            <button type="button" onClick={openTeaching}>进入课表与蹭课中心</button>
            <button type="button" className="dormitory-entry-button" onClick={openDormitory}>进入升华公寓群聊 <span aria-hidden="true">↗</span></button>
            <button type="button" className="sidebar-timetable" onClick={openQuickTimetable}>快速录入个人课表 <span aria-hidden="true">↗</span></button>
          </div>
          <a className="original-link" href="/maps/campus-final-v9.png" target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
        </aside>
        <MapViewport active={page === 'campus'} onOpenTeaching={openTeaching} onOpenDormitory={openDormitory} />
      </div>
      {timetableOpen && page === 'campus' && (
        <div className="timetable-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTimetable(); }}>
          <section className="timetable-modal" role="dialog" aria-modal="true" aria-labelledby="timetable-modal-title">
            <header className="timetable-modal-head">
              <div><span className="eyebrow">LIBRARY · STUDY</span><h2 id="timetable-modal-title">学习 · 我的课表</h2></div>
              <button type="button" className="timetable-modal-close" aria-label="关闭课表录入" onClick={closeTimetable}>×</button>
            </header>
            <p className="timetable-modal-intro">按教务系统的星期与节次点击格子，录入你的课程。内容只保存在当前浏览器。</p>
            <TimetableEditor onDirtyChange={setTimetableDirty} />
          </section>
        </div>
      )}
    </main>
    {page === 'teaching' && <TeachingPage onBack={returnToCampus} />}
    {page === 'dormitory' && <DormitoryPage onBack={returnFromDormitory} />}
    </>
  );
}
