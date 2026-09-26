import { useEffect, useState } from 'react';
import MapViewport from '../game/MapViewport';
import TimetableEditor from '../features/teaching/TimetableEditor';

export default function App() {
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [timetableDirty, setTimetableDirty] = useState(false);

  const closeTimetable = () => {
    if (timetableDirty && !window.confirm('课表表单还有未保存内容，确定关闭吗？')) return;
    setTimetableOpen(false);
  };

  useEffect(() => {
    if (!timetableOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTimetable();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [timetableOpen, timetableDirty]);

  return (
    <main className="campus-app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <button type="button" className="timetable-trigger" onClick={() => setTimetableOpen(true)}>录入课表</button>
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
            <button type="button" className="sidebar-timetable" onClick={() => setTimetableOpen(true)}>给我一个位置录入课表 <span aria-hidden="true">↗</span></button>
          </div>
          <a className="original-link" href="/maps/campus-final-v9.png" target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
        </aside>
        <MapViewport />
      </div>
      {timetableOpen && (
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
  );
}
