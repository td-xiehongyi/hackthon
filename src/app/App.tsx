/**
 * 应用首页：地图探索页 ↔ 地点功能页的宿主。
 *
 * v20 通行范围由颜色提取与人工规则合成、边界待核验。已核验的互动记录才开放 E 键入口。
 * 原位返回、输入锁和定位总览接入同一宿主；缺失的正式入口保留空值。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import TeachingPage from '../features/teaching/TeachingPage';
import TimetableEditor from '../features/teaching/TimetableEditor';
import MapViewport from '../game/MapViewport';
import { MAP_IMAGE_PATH } from '../shared/contracts';
import type { MapAnnotation } from '../shared/contracts';
import type { CampusMapScene } from '../game/CampusMapScene';
import type { OpenContext } from './place-session';
import NavigationOverview from './NavigationOverview';
import PlaceHost, { type PlaceHostHandle } from './PlaceHost';

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

  const hostHandle = useRef<PlaceHostHandle | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const mapScene = useRef<CampusMapScene | null>(null);
  const [annotation, setAnnotation] = useState<MapAnnotation | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const mapBlocked = page !== 'campus' || timetableOpen || placeOpen || overview || returnError !== null;
  const blockedRef = useRef(mapBlocked);
  blockedRef.current = mapBlocked;
  const registerScene = useCallback((scene: CampusMapScene | null) => {
    mapScene.current = scene;
    scene?.setSuspended(blockedRef.current);
  }, []);
  useEffect(() => { mapScene.current?.setSuspended(mapBlocked); }, [mapBlocked]);
  const requestOpen = useCallback((context: OpenContext) => { hostHandle.current?.requestOpen(context); }, []);
  const validateOpen = useCallback((context: OpenContext) => mapScene.current?.canOpen(context) ?? false, []);

  const registerHandle = useCallback((handle: PlaceHostHandle | null) => {
    hostHandle.current = handle;
  }, []);

  // 正式地图接入角色后：暂停移动并清键 / 恢复按 E 时的原位置与朝向。
  const onSuspendMap = useCallback(() => { mapScene.current?.setSuspended(true); }, []);
  const onResumeMap = useCallback((context: OpenContext) => {
    setReturnError(mapScene.current?.restore(context) ?? null);
    requestAnimationFrame(() => document.querySelector<HTMLCanvasElement>('.map-canvas canvas')?.focus());
  }, []);

  return (
    <>
    <main className="campus-app" hidden={page !== 'campus'}>
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <span className="preview-label">{placeOpen ? '地点功能页' : '地图预览'}</span>
      <button type="button" className="timetable-trigger" disabled={placeOpen || overview} onClick={openQuickTimetable}>快速录入课表</button>
      </header>
      {overview && <NavigationOverview annotation={annotation} onClose={() => {
        setOverview(false);
        if (!returnError) mapScene.current?.setSuspended(false);
      }} onTeleport={(id) => mapScene.current ? mapScene.current.teleport(id) : '地图尚未就绪'} />}

      <PlaceHost
        onSuspendMap={onSuspendMap}
        onResumeMap={onResumeMap}
        registerHandle={registerHandle}
        onOpenChange={setPlaceOpen}
        validateOpen={validateOpen}
        annotation={annotation}
      >
        {/* 地图探索页：功能页打开时保留地图状态并暂停探索，因此保持挂载。 */}
        <div className="workspace" hidden={placeOpen}>
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
            <button onClick={() => { mapScene.current?.setSuspended(true); setOverview(true); }}>地图总览与搜索</button>
            <div className="preview-note">
              <strong>角色已在地图中心，直接按键跑动</strong>
              <p>WASD 移动，按住 Shift 骑行；点“浏览”可拖动查看全图。</p>
              <p>草地、操场、桥面及建筑和道路附近的树木可通行，窄路可骑行；地点入口仍待标定。</p>
            </div>
            <div className="preview-note">
              <strong>教学楼群已开放</strong>
              <p>课表与蹭课中心可通过快捷入口打开。</p>
              <button type="button" onClick={openTeaching}>进入课表与蹭课中心</button>
              <button type="button" className="sidebar-timetable" onClick={openQuickTimetable}>快速录入个人课表 <span aria-hidden="true">↗</span></button>
            </div>
            <a className="original-link" href={MAP_IMAGE_PATH} target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
          </aside>
          {returnError && <p role="alert">{returnError}</p>}
          <MapViewport active={!mapBlocked} onOpenTeaching={openTeaching} registerScene={registerScene} onRequestOpen={requestOpen} onAnnotation={setAnnotation} />
        </div>
      </PlaceHost>
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
    </>
  );
}
