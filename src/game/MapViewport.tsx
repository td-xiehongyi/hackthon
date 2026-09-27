import { useCallback, useEffect, useRef, useState } from 'react';
import ExplorerSidebar from '../app/ExplorerSidebar';
import CampusMapOverlay from '../app/CampusMapOverlay';
import { isEditableTarget } from './input/movement-keys';
import type { CampusProfile } from '../app/campus-profile';
import * as Phaser from 'phaser';
import { CampusMapScene, type CharacterStatus, type CollisionSource, type ViewMode } from './CampusMapScene';
import type { OpenContext } from '@/app/place-session';
import type { MapAnnotation, PlaceId } from '@/shared/contracts';
import { getPlace } from '@/shared/place-registry';
import { CHARACTER_CHOICES, type CharacterChoice } from './character/choices';

interface MapViewportProps {
  characterChoice?: CharacterChoice;
  active?: boolean;
  placeOpen?: boolean;
  profile?: CampusProfile | null;
  onReturnHome: () => void;
  registerScene?: (scene: CampusMapScene | null) => void;
  onRequestOpen?: (context: OpenContext) => void;
  onAnnotation?: (annotation: MapAnnotation | null) => void;
}

export default function MapViewport({ characterChoice = CHARACTER_CHOICES[0], active = true, placeOpen = false, profile = null, onReturnHome, registerScene, onRequestOpen, onAnnotation }: MapViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CampusMapScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterStatus | null>(null);
  const [collision, setCollision] = useState<{ source: CollisionSource; detail: string } | null>(null);
  const [target, setTarget] = useState<PlaceId | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const closeMap = useCallback(() => {
    setMapOpen(false);
    requestAnimationFrame(() => host.current?.querySelector('canvas')?.focus());
  }, []);

  useEffect(() => {
    scene.current?.setSuspended(!active || mapOpen);
  }, [active, mapOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyM' || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey
        || isEditableTarget(event.target) || !active || placeOpen || status !== 'ready') return;
      event.preventDefault();
      if (mapOpen) closeMap();
      else {
        scene.current?.setSuspended(true);
        setMapOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, placeOpen, status, mapOpen, closeMap]);

  useEffect(() => {
    if (!host.current) return;
    let mounted = true;
    const map = new CampusMapScene({
      onReady: () => mounted && setStatus('ready'),
      onError: () => mounted && setStatus('error'),
      onZoom: (value) => mounted && setZoom(value),
      onCharacterError: (message) => mounted && setCharacterError(message),
      onCharacterStatus: (value) => mounted && setCharacter(value),
      onViewModeChange: (mode) => mounted && setViewMode(mode),
      onCollisionSource: (source, detail) => mounted && setCollision({ source, detail }),
      onTarget: (value) => mounted && setTarget(value),
      onRequestOpen,
      onAnnotation,
    }, 'character', characterChoice);
    scene.current = map;
    registerScene?.(map);
    let game: Phaser.Game | undefined;
    try {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: '#e3eadd',
        pixelArt: true,
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        scene: [map],
      });
      game.canvas.setAttribute('aria-label', '校园地图：拖动与缩放浏览，按 WASD 恢复角色移动，按住 Shift 骑行');
      game.canvas.setAttribute('role', 'img');
      game.canvas.tabIndex = 0;
      const canvas = game.canvas;
      canvas.addEventListener('pointerdown', () => canvas.focus());
    } catch {
      setStatus('error');
    }
    return () => {
      mounted = false;
      scene.current = null;
      registerScene?.(null);
      game?.destroy(true);
    };
  }, [registerScene, onRequestOpen, onAnnotation, characterChoice]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => scene.current?.fitToWindow());
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  const ready = status === 'ready';
  const characterAvailable = ready && characterError === null && collision?.source === 'annotation';

  function returnToCharacter() {
    scene.current?.setViewMode('character');
    host.current?.querySelector('canvas')?.focus();
  }

  return (
    <div className={`campus-explorer${active && !mapOpen ? '' : ' is-paused'}`}>
      <ExplorerSidebar character={character} choice={characterChoice} profile={profile} onReturnHome={onReturnHome} returnHomeDisabled={placeOpen || mapOpen} />
      <section className="explorer-map" aria-label="校园探索地图" inert={!active || mapOpen}>
        <div ref={host} className="map-canvas" />
        <span role="status" aria-label="地图加载状态" className="visually-hidden">{ready ? '地图已加载' : status === 'loading' ? '正在加载地图…' : '地图未加载'}</span>
        <div className="explorer-compass" aria-label="正北方向">N<b>↑</b></div>
        <div className="explorer-map-tools" aria-label="地图浏览控件">
          <button aria-label="放大地图" disabled={!ready} onClick={() => scene.current?.changeZoom(1.25)}>+</button>
          <button aria-label="缩小地图" disabled={!ready} onClick={() => scene.current?.changeZoom(1 / 1.25)}>−</button>
          <button aria-label="回到角色位置" title="回到角色位置" disabled={!characterAvailable} onClick={returnToCharacter}>⌖</button>
        </div>
        <div className="explorer-touch-pad" aria-label="触屏方向控制">
          {([['KeyW', '上', '↑'], ['KeyA', '左', '←'], ['KeyS', '下', '↓'], ['KeyD', '右', '→']] as const).map(([code, name, icon]) => <button key={code} aria-label={'向' + name + '移动'} disabled={!characterAvailable} onPointerDown={event => {
            event.preventDefault();
            if (viewMode !== 'character') returnToCharacter();
            event.currentTarget.setPointerCapture(event.pointerId);
            scene.current?.keys.keyDown({ code, target: event.currentTarget });
          }} onPointerUp={event => scene.current?.keys.keyUp({ code, target: event.currentTarget })} onPointerCancel={event => scene.current?.keys.keyUp({ code, target: event.currentTarget })} onLostPointerCapture={event => scene.current?.keys.keyUp({ code, target: event.currentTarget })}>{icon}</button>)}
        </div>
        <div className="explorer-map-status">
          <span>{viewMode === 'character' ? '角色跟随' : '自由浏览'}</span> · <output aria-label="当前缩放">{ready ? Math.round(zoom * 100) + '%' : '—'}</output>
          <small>{characterChoice.name} · {character?.mode === 'ride' ? '骑行' : '步行'}</small>
          <small>M 查看地图</small>
          {viewMode === 'browse' && characterAvailable && <small>按 WASD 继续行走 · ⌖ 回到角色</small>}
        </div>
        {character && <span data-testid="character-status" className="visually-hidden">
          {characterChoice.name} ·
          位置 {Math.round(character.x)}, {Math.round(character.y)} · {character.mode === 'ride' ? '骑行' : '步行'} · 朝向 {character.facing}
        </span>}
        {target && <p className="map-interact-prompt" data-testid="interact-prompt">按 E 进入【{getPlace(target)?.name}】</p>}
        {collision?.source === 'unavailable' && <p className="explorer-warning" role="note"><strong>移动已停用：</strong>{collision.detail}。仍可拖动浏览地图。</p>}
        {characterError && <p className="explorer-warning" role="alert">{characterError}</p>}
        {status === 'loading' && <div className="map-message">正在展开校园地图…</div>}
        {status === 'error' && <div className="map-message" role="alert"><strong>地图加载失败</strong><p>请确认地图文件可读取，然后重新加载页面。</p><button onClick={() => window.location.reload()}>重新加载</button></div>}
      </section>
      {mapOpen && <CampusMapOverlay character={character} onClose={closeMap} />}
    </div>
  );
}
