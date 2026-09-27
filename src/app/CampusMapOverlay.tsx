import { useEffect, useRef, useState } from 'react';
import { MAP_IMAGE_PATH, MAP_WIDTH_PX, MAP_HEIGHT_PX } from '../shared/contracts';
import type { CharacterStatus } from '../game/CampusMapScene';
import './campus-map-overlay.css';

const fullMap = { zoom: 1, x: MAP_WIDTH_PX / 2, y: MAP_HEIGHT_PX / 2 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function camera(view: typeof fullMap, width: number, height: number, fit: number) {
  const scale = fit * view.zoom;
  const w = width / scale;
  const h = height / scale;
  return {
    ...view, scale, w, h,
    x: w >= MAP_WIDTH_PX ? MAP_WIDTH_PX / 2 : clamp(view.x, w / 2, MAP_WIDTH_PX - w / 2),
    y: h >= MAP_HEIGHT_PX ? MAP_HEIGHT_PX / 2 : clamp(view.y, h / 2, MAP_HEIGHT_PX - h / 2),
  };
}

export default function CampusMapOverlay({ character, onClose }: {
  character: CharacterStatus | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: MAP_WIDTH_PX, height: MAP_HEIGHT_PX });
  const [view, setView] = useState(fullMap);
  const fit = Math.min(size.width / MAP_WIDTH_PX, size.height / MAP_HEIGHT_PX);
  const current = camera(view, size.width, size.height, fit);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - rect.left - rect.width / 2;
      const dy = event.clientY - rect.top - rect.height / 2;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setView(previous => {
        const old = camera(previous, size.width, size.height, fit);
        const zoom = clamp(previous.zoom * Math.exp(-delta * 0.002), 1, 6);
        return camera({ zoom, x: old.x + dx / old.scale - dx / (fit * zoom), y: old.y + dy / old.scale - dy / (fit * zoom) }, size.width, size.height, fit);
      });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [fit, size.width, size.height]);

  function zoomBy(factor: number) {
    setView(camera({ ...current, zoom: clamp(view.zoom * factor, 1, 6) }, size.width, size.height, fit));
  }

  return <dialog ref={dialog} className="place-overlay campus-map-overlay" aria-labelledby="campus-map-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="campus-map-heading">
      <h2 id="campus-map-title">校园地图</h2>
      <button type="button" onClick={onClose} autoFocus aria-label="关闭地图">关闭 ×</button>
    </header>
    <div className="campus-map-toolbar" aria-label="大地图浏览控件">
      <button type="button" aria-label="缩小地图" disabled={view.zoom <= 1} onClick={() => zoomBy(1 / 1.25)}>−</button>
      <output aria-label="大地图缩放比例">{Math.round(view.zoom * 100)}%</output>
      <button type="button" aria-label="放大地图" disabled={view.zoom >= 6} onClick={() => zoomBy(1.25)}>+</button>
      <button type="button" disabled={!character} onClick={() => character && setView({ zoom: Math.max(2, view.zoom), x: character.x, y: character.y })}>定位当前位置</button>
      <button type="button" onClick={() => setView(fullMap)}>查看全图</button>
    </div>
    <div className="campus-map-image">
      <svg ref={viewport} viewBox={`${current.x - current.w / 2} ${current.y - current.h / 2} ${current.w} ${current.h}`} role="img" aria-label="完整校园地图与当前位置"
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          const previous = drag.current;
          if (!previous || previous.id !== event.pointerId) return;
          const dx = event.clientX - previous.x;
          const dy = event.clientY - previous.y;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setView(value => {
            const old = camera(value, size.width, size.height, fit);
            return camera({ ...value, x: old.x - dx / old.scale, y: old.y - dy / old.scale }, size.width, size.height, fit);
          });
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}>
        <image href={MAP_IMAGE_PATH} width={MAP_WIDTH_PX} height={MAP_HEIGHT_PX} />
        {character && <g>
          <circle cx={character.x} cy={character.y} r={16 / current.scale} fill="#d63535" fillOpacity="0.25" />
          <circle data-testid="map-player-marker" cx={character.x} cy={character.y} r={8 / current.scale} fill="#d63535" stroke="white" strokeWidth={3 / current.scale} />
          <g transform={`translate(${character.x} ${character.y}) scale(${1 / current.scale})`}>
            <rect x="-39" y="-43" width="78" height="25" rx="4" fill="#fffaf0" stroke="#ad2929" />
            <text x="0" y="-26" textAnchor="middle" fill="#ad2929" fontSize="12" fontWeight="bold">你在这里</text>
          </g>
        </g>}
      </svg>
    </div>
  </dialog>;
}
