import { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { CampusMapScene } from './CampusMapScene';

type MapViewportProps = {
  active?: boolean;
  onOpenTeaching: () => void;
  onOpenDormitory: () => void;
};

export default function MapViewport({ active = true, onOpenTeaching, onOpenDormitory }: MapViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CampusMapScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoom, setZoom] = useState(1);
  const [nearTeaching, setNearTeaching] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    let mounted = true;
    const map = new CampusMapScene({
      onReady: () => mounted && setStatus('ready'),
      onError: () => mounted && setStatus('error'),
      onZoom: (value) => mounted && setZoom(value),
      onOpenTeaching,
      onOpenDormitory,
      onTeachingProximity: (near) => mounted && setNearTeaching(near),
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
      game.canvas.setAttribute('aria-label', '校园地图，可拖动浏览，使用上方按钮缩放');
      game.canvas.setAttribute('role', 'img');
    } catch {
      setStatus('error');
    }
    return () => {
      mounted = false;
      scene.current = null;
      game?.destroy(true);
    };
  }, [onOpenTeaching, onOpenDormitory]);

  useEffect(() => {
    if (!active) return;
    const frame = window.requestAnimationFrame(() => scene.current?.fitToWindow());
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  return (
    <section className="map-panel" aria-label="地图预览">
      <div className="map-toolbar">
        <div className="map-status">
          <span className={`status-dot ${status}`} />
          <span role="status" aria-label="地图加载状态">{status === 'ready' ? '地图已加载' : status === 'loading' ? '正在加载地图…' : '地图未加载'}</span>
        </div>
        <div className="map-controls" aria-label="地图浏览控件">
          <button
            className="place-entry-button"
            disabled={status !== 'ready'}
            onClick={onOpenTeaching}
          >
            进入教学楼群
          </button>
          <button
            className="dorm-entry-map-button"
            disabled={status !== 'ready'}
            onClick={onOpenDormitory}
          >
            升华公寓群聊
          </button>
          <button aria-label="缩小地图" disabled={status !== 'ready'} onClick={() => scene.current?.changeZoom(1 / 1.25)}>−</button>
          <output aria-label="当前缩放">{status === 'ready' ? `${Math.round(zoom * 100)}%` : '—'}</output>
          <button aria-label="放大地图" disabled={status !== 'ready'} onClick={() => scene.current?.changeZoom(1.25)}>+</button>
          <button className="fit-button" disabled={status !== 'ready'} onClick={() => scene.current?.fitToWindow()}>适应窗口</button>
        </div>
      </div>
      <div className="map-stage">
        <div ref={host} className="map-canvas" />
        {nearTeaching && <div className="map-proximity-hint" role="status">已到达教学楼群，正在打开课表…</div>}
        {status === 'loading' && <div className="map-message">正在展开校园地图…</div>}
        {status === 'error' && (
          <div className="map-message" role="alert">
            <strong>地图加载失败</strong>
            <p>请确认地图文件可读取，然后重新加载页面。</p>
            <button onClick={() => window.location.reload()}>重新加载</button>
          </div>
        )}
      </div>
      <div className="map-footer"><span>方向键 / WASD 移动人物 · 走到“课”附近自动进入 · 点击“宿”标记进入升华公寓</span><span>1041 × 1511 · 原始地图</span></div>
    </section>
  );
}
