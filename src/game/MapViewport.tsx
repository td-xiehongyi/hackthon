import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { CampusMapScene, type CharacterStatus, type CollisionSource, type ViewMode } from './CampusMapScene';

export default function MapViewport() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CampusMapScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterStatus | null>(null);
  const [collision, setCollision] = useState<{ source: CollisionSource; detail: string } | null>(null);
  const [overlay, setOverlay] = useState(false);

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
    });
    scene.current = map;
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
      game.canvas.setAttribute('aria-label', '校园地图：浏览模式可拖动与缩放；角色模式用 WASD 移动、按住 Shift 骑行');
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
      game?.destroy(true);
    };
  }, []);

  function switchMode(mode: ViewMode) {
    scene.current?.setViewMode(mode);
    if (mode === 'character') host.current?.querySelector('canvas')?.focus();
  }

  const ready = status === 'ready';
  const characterAvailable = ready && characterError === null;

  return (
    <section className="map-panel" aria-label="地图预览">
      <div className="map-toolbar">
        <div className="map-status">
          <span className={`status-dot ${status}`} />
          <span role="status" aria-label="地图加载状态">{ready ? '地图已加载' : status === 'loading' ? '正在加载地图…' : '地图未加载'}</span>
        </div>
        <div className="map-controls" aria-label="地图浏览控件">
          <div className="mode-switch" role="group" aria-label="地图模式">
            <button aria-pressed={viewMode === 'browse'} disabled={!ready} onClick={() => switchMode('browse')}>浏览</button>
            <button aria-pressed={viewMode === 'character'} disabled={!characterAvailable} onClick={() => switchMode('character')}>角色</button>
          </div>
          <button aria-label="缩小地图" disabled={!ready} onClick={() => scene.current?.changeZoom(1 / 1.25)}>−</button>
          <output aria-label="当前缩放">{ready ? `${Math.round(zoom * 100)}%` : '—'}</output>
          <button aria-label="放大地图" disabled={!ready} onClick={() => scene.current?.changeZoom(1.25)}>+</button>
          <button
            className="fit-button"
            aria-pressed={overlay}
            disabled={!ready || collision?.source !== 'annotation'}
            onClick={() => {
              scene.current?.setOverlayVisible(!overlay);
              setOverlay(!overlay);
            }}
          >
            通行区域
          </button>
          <button className="fit-button" disabled={!ready} onClick={() => scene.current?.fitToWindow()}>
            {viewMode === 'character' ? '回到角色' : '适应窗口'}
          </button>
        </div>
      </div>
      {viewMode === 'character' && collision?.source === 'free-roam' && (
        <p className="map-uncalibrated" role="note">
          <strong>临时自由移动：</strong>{collision.detail}，角色目前可穿过建筑和水面，只限制在图片范围内。
        </p>
      )}
      {viewMode === 'character' && collision?.source === 'annotation' && (
        <p className="map-uncalibrated map-annotation-note" role="note">
          <strong>通行范围：</strong>道路、步道与桥面由底图颜色自动提取（{collision.detail}），建筑、水面、草地和树林不可通行。
          如发现走不通或能穿墙的地方，请点“通行区域”查看并告诉我位置。起点暂取地图中心附近，角色为临时占位造型。
        </p>
      )}
      <div className="map-stage">
        <div ref={host} className="map-canvas" />
        {status === 'loading' && <div className="map-message">正在展开校园地图…</div>}
        {status === 'error' && (
          <div className="map-message" role="alert">
            <strong>地图加载失败</strong>
            <p>请确认地图文件可读取，然后重新加载页面。</p>
            <button onClick={() => window.location.reload()}>重新加载</button>
          </div>
        )}
      </div>
      <div className="map-footer">
        {viewMode === 'character' ? (
          <span data-testid="character-status">
            WASD 移动 · 按住 Shift 骑行
            {character && ` · 位置 ${Math.round(character.x)}, ${Math.round(character.y)} · ${character.mode === 'ride' ? '骑行' : '步行'} · 朝向 ${character.facing}`}
          </span>
        ) : (
          <span>拖动浏览 · 滚轮缩放{characterAvailable ? ' · 点“角色”放入角色' : ''}</span>
        )}
        {characterError ? <span role="alert">{characterError}</span> : <span>1041 × 1511 · v20 原始地图</span>}
      </div>
    </section>
  );
}
