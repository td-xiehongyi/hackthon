/**
 * 应用首页：地图探索页 ↔ 地点功能页的宿主。
 *
 * v20 通行范围由颜色提取与人工规则合成、边界待核验。已核验的互动记录才开放 E 键入口。
 * 原位返回、输入锁和定位总览接入同一宿主；互动区域按当前游戏底图配置。
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import TeachingPage from '../features/teaching/TeachingPage';
import DormitoryPage from '../features/dormitory/DormitoryPage';
import MapViewport from '../game/MapViewport';
import type { MapAnnotation } from '../shared/contracts';
import type { CampusMapScene } from '../game/CampusMapScene';
import type { OpenContext } from './place-session';
import PlaceHost, { type PlaceHostHandle } from './PlaceHost';
import StartScreen from './StartScreen';
import { readCampusProfile, saveCampusProfile, type CampusProfile } from './campus-profile';
import './explorer.css';
import './place-overlay.css';
import { readCharacterChoice, saveCharacterChoice, type CharacterChoice } from '../game/character/choices';

const ScenePackagePage = lazy(() => import('../features/scene-package/ScenePackagePage'));
const pageFromHash = () => window.location.hash === '#scenes' ? 'scenes' : window.location.hash === '#teaching' ? 'teaching' : window.location.hash === '#dormitory' ? 'dormitory' : 'campus';

export default function App() {
  const [profile, setProfile] = useState(readCampusProfile);
  const updateProfile = (next: CampusProfile | null) => {
    saveCampusProfile(next);
    setProfile(next);
  };
  const [entered, setEntered] = useState(() => ['#teaching', '#dormitory'].includes(window.location.hash));
  const [character, setCharacter] = useState(readCharacterChoice);
  const [mapCharacter, setMapCharacter] = useState(character);
  const [mapStarted, setMapStarted] = useState(() => ['#teaching', '#dormitory'].includes(window.location.hash));
  const selectCharacter = (choice: CharacterChoice) => {
    setCharacter(choice);
    saveCharacterChoice(choice);
  };
  const [page, setPage] = useState<'campus' | 'teaching' | 'dormitory' | 'scenes'>(pageFromHash);
  const openScenes = () => {
    window.history.pushState({ csuView: 'scenes' }, '', '#scenes');
    setPage('scenes');
  };
  const returnHome = () => {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    setEntered(false);
    setPage('campus');
  };
  const returnToCampus = useCallback(() => {
    if (['teaching', 'dormitory'].includes(window.history.state?.csuView)) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    setPage('campus');
  }, []);

  useEffect(() => {
    const handleHistory = () => setPage(pageFromHash());
    window.addEventListener('popstate', handleHistory);
    return () => window.removeEventListener('popstate', handleHistory);
  }, []);
  const hostHandle = useRef<PlaceHostHandle | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const mapScene = useRef<CampusMapScene | null>(null);
  const [annotation, setAnnotation] = useState<MapAnnotation | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const mapBlocked = !entered || page !== 'campus' || placeOpen || returnError !== null;
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
    {!entered && page === 'campus' && <StartScreen character={character} onSelect={selectCharacter} profile={profile} onProfileChange={updateProfile} onImportScene={openScenes} onEnter={() => {
      setMapCharacter(character);
      setMapStarted(true);
      setEntered(true);
    }} />}
    <main className="campus-shell" hidden={!entered || page !== 'campus'}>
      <PlaceHost
        characterChoice={mapCharacter}
        onSuspendMap={onSuspendMap}
        onResumeMap={onResumeMap}
        registerHandle={registerHandle}
        onOpenChange={setPlaceOpen}
        validateOpen={validateOpen}
        annotation={annotation}
      >
        {/* 地图探索页：功能页打开时保留地图状态并暂停探索，因此保持挂载。 */}
        <div>
          {returnError && <p className="explorer-return-error" role="alert">{returnError}</p>}
          {mapStarted && <MapViewport key={mapCharacter.id} characterChoice={mapCharacter} profile={profile} active={!mapBlocked} placeOpen={placeOpen} onReturnHome={() => setEntered(false)} registerScene={registerScene} onRequestOpen={requestOpen} onAnnotation={setAnnotation} />}
        </div>
      </PlaceHost>
    </main>
    {page === 'teaching' && <TeachingPage onBack={returnToCampus} />}
    {page === 'dormitory' && <DormitoryPage onBack={returnToCampus} />}
    {page === 'scenes' && <Suspense fallback={<p role="status">正在打开场景导入…</p>}><ScenePackagePage character={character} onBack={returnHome} /></Suspense>}
    </>
  );
}
