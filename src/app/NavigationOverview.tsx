import { useEffect, useRef, useState } from 'react';
import { MAP_DISPLAY_IMAGE_PATH, MAP_WIDTH_PX, MAP_HEIGHT_PX, type MapAnnotation, type Point, type NavigationTarget } from '@/shared/contracts';
import { PLACE_REGISTRY } from '@/shared/place-registry';
import { resolveNavigation } from '@/game/map-data';

export default function NavigationOverview({ marker = null, annotation = null, onClose, onTeleport }: {
  marker?: { point: Point; label: string } | null;
  annotation?: MapAnnotation | null;
  onClose: () => void;
  onTeleport?: (id: string) => string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(marker);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const targets: { label: string; target: NavigationTarget }[] = [
    ...PLACE_REGISTRY.map((place) => ({ label: place.name, target: { kind: 'place' as const, placeId: place.placeId } })),
    ...(annotation?.landmarks ?? []).map((l) => ({ label: l.name, target: { kind: 'landmark' as const, landmarkId: l.id } })),
    ...(annotation?.buildings ?? []).map((b) => ({ label: b.name, target: { kind: 'building' as const, buildingId: b.id } })),
  ];
  const safePoints = annotation?.safePoints.filter((p) => p.verificationStatus === 'verified' && p.usage.includes('teleport')) ?? [];
  function locate(target: NavigationTarget) {
    const result = resolveNavigation(annotation, target);
    if (result.status === 'marked') { setSelected(result); setMessage(`已标记：${result.label}`); }
    else { setSelected(null); setMessage(result.message); }
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="navigation-overview" aria-label="地图定位总览"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><h2>{selected?.label ?? '地图总览'}</h2><button onClick={onClose} autoFocus>{onTeleport ? '返回地图探索' : '返回地点页面'}</button></header>
    <p>地图标记 · 角色保留在进入页面时的位置</p>
    <label>搜索地点或地标<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="place-actions">{targets.filter((t) => t.label.includes(query.trim())).map((t) =>
      <button key={JSON.stringify(t.target)} onClick={() => locate(t.target)}>{t.label}</button>)}</div>
    {message && <p role="status">{message}</p>}
    {onTeleport && <div className="place-actions">
      {safePoints.length === 0 && <p>尚无已核验的快速移动落点。</p>}
      {safePoints.map((p) => <button key={p.id} onClick={() => {
        const error = onTeleport(p.id);
        if (error) setMessage(error); else onClose();
      }}>前往 {p.id}</button>)}
    </div>}
    <svg viewBox={`0 0 ${MAP_WIDTH_PX} ${MAP_HEIGHT_PX}`} role="img" aria-label={`${selected?.label ?? '校园'}的地图位置`}>
      <image href={MAP_DISPLAY_IMAGE_PATH} width={MAP_WIDTH_PX} height={MAP_HEIGHT_PX} />
      {selected && <circle data-testid="navigation-marker" cx={selected.point.x} cy={selected.point.y} r="16" fill="#e44336" stroke="white" strokeWidth="5" />}
    </svg>
  </dialog>;
}
