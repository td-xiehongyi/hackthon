import { useEffect, useRef, useState, type FormEvent } from 'react';
import CharacterPreview from '../../game/character/CharacterPreview';
import type { CharacterChoice } from '../../game/character/choices';
import { assertPackageBudget, exportSceneZip, imageBlob, MAX_ZIP_BYTES, parseSceneZip, validateImages, type Position, type SavedScene, type ScenePoint } from './package';
import { loadScenes, saveScene } from './storage';
import './scene-package.css';

const featureNames = { photos: '地点相册', clubs: '社团', reviews: '食堂点评', timetable: '课程表' };
const messageOf = (error: unknown) => error instanceof Error ? error.message : '操作失败，请重试。';

export default function ScenePackagePage({ character, onBack }: { character: CharacterChoice; onBack: () => void }) {
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState('正在读取本地场景…');
  const [error, setError] = useState('');
  const operation = useRef(false);
  const current = scenes.find(scene => scene.id === currentId);
  useEffect(() => {
    let cancelled = false;
    loadScenes().then(items => {
      if (cancelled) return;
      setScenes(items);
      setCurrentId(items[0]?.id ?? '');
      setStatus(items.length ? '已恢复本地场景' : '选择 pixel-scene 生成的场景 ZIP，开始探索。');
    }).catch(e => { if (!cancelled) setError(messageOf(e)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, []);
  async function importZip(file?: File) {
    if (!file || busy || operation.current) return;
    operation.current = true;
    setBusy(true); setError(''); setStatus('正在读取地图和交互信息…');
    try {
      if (file.size > MAX_ZIP_BYTES) throw new Error('ZIP 不能超过 64 MB。');
      const value = parseSceneZip(new Uint8Array(await file.arrayBuffer()));
      await validateImages(value.assets);
      assertPackageBudget(value);
      const saved: SavedScene = { ...value, id: crypto.randomUUID(), importedAt: Date.now(), revision: 0 };
      await saveScene(saved);
      setScenes(items => [saved, ...items]);
      setCurrentId(saved.id);
      setStatus(`导入完成 · ${saved.scene.points.length} 个交互点 · 已保存到当前浏览器`);
    } catch (e) { setError(messageOf(e)); setStatus('导入未完成，已打开的场景仍保留。'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function persistPoint(point: ScenePoint, assets = current?.assets) {
    if (!current || !assets) return;
    const next = { ...current, assets, revision: (current.revision ?? 0) + 1, scene: { ...current.scene, points: current.scene.points.map(p => p.id === point.id ? point : p) } };
    assertPackageBudget(next);
    await saveScene(next);
    setScenes(items => items.map(item => item.id === next.id ? next : item));
    setStatus('已保存到当前浏览器');
  }
  async function updatePoint(point: ScenePoint) {
    if (!current || busy || operation.current) return;
    operation.current = true;
    setBusy(true); setError(''); setStatus('正在保存…');
    try {
      await persistPoint(point);
    } catch (e) { setError(messageOf(e)); setStatus('保存未完成'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function addPhoto(point: ScenePoint, file?: File) {
    if (!file || !current || busy || operation.current) return;
    operation.current = true;
    setBusy(true); setError(''); setStatus('正在保存照片…');
    try {
      if (point.photos.length >= 500) throw new Error('每个地点最多保存 500 张照片。');
      if (file.size > 16 * 1024 * 1024) throw new Error('单张照片不能超过 16 MB。');
      const path = `assets/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase()}`;
      const blob = imageBlob(new Uint8Array(await file.arrayBuffer()), path);
      await validateImages({ photo: blob });
      await persistPoint({ ...point, photos: [...point.photos, { path, caption: file.name.slice(0, 200) }] }, { ...current.assets, [path]: blob });
    } catch (e) { setError(messageOf(e)); setStatus('照片保存未完成'); }
    finally { operation.current = false; setBusy(false); }
  }
  async function download() {
    if (!current || busy || operation.current) return;
    operation.current = true;
    setBusy(true); setError('');
    try {
      const url = URL.createObjectURL(await exportSceneZip(current));
      const a = document.createElement('a');
      a.href = url; a.download = `${current.scene.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')}.scene.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus('场景 ZIP 已导出');
    } catch (e) { setError(messageOf(e)); }
    finally { operation.current = false; setBusy(false); }
  }
  return <main className="scene-package-page">
    <header className="scene-package-header">
      <div><span className="scene-eyebrow">中南大学像素校园 / 自定义场景</span><h1>把你的地图带进校园</h1></div>
      <button onClick={onBack}>返回校园首页</button>
    </header>
    <section className="scene-toolbar" aria-label="场景管理">
      <label className={`scene-file-button ${busy ? 'is-busy' : ''}`}>＋ 导入场景 ZIP
        <input aria-label="选择场景 ZIP" type="file" accept=".zip,application/zip" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void importZip(file); }} />
      </label>
      <label className="scene-select">本地场景<select aria-label="本地场景" value={currentId} disabled={busy || !scenes.length} onChange={e => setCurrentId(e.target.value)}>
        {!scenes.length && <option value="">尚未导入</option>}
        {scenes.map((item, index) => <option value={item.id} key={item.id}>{item.scene.name} · {index + 1}</option>)}
      </select></label>
      <button disabled={busy || !current} onClick={() => void download()}>导出场景 ZIP</button>
    </section>
    <p role="status" className="scene-status">{status}</p>
    {error && <p role="alert" className="scene-error">{error}</p>}
    {current ? <SceneView key={current.id} value={current} character={character} busy={busy} updatePoint={updatePoint} addPhoto={addPhoto} /> : <section className="scene-empty">
      <span aria-hidden="true">▧</span><h2>一张地图，一段新的探索</h2>
      <p>导入 Skill 生成的 ZIP，显示像素场景、地点照片、社团、点评和课表。</p>
      <p>支持 scene.json ＋ 图片的场景包，也支持只有一张图片的 ZIP。最大 64 MB。</p>
    </section>}
    <footer className="scene-storage-note">场景与新增内容保存在当前浏览器。清理网站数据或更换浏览器、启动地址后不会自动同步，请用「导出场景 ZIP」备份。</footer>
  </main>;
}

function SceneView({ value, character, busy, updatePoint, addPhoto }: {
  value: SavedScene; character: CharacterChoice; busy: boolean;
  updatePoint: (point: ScenePoint) => Promise<void>;
  addPhoto: (point: ScenePoint, file?: File) => Promise<void>;
}) {
  const { scene, assets } = value;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState('');
  const [pos, setPos] = useState<Position>(scene.spawn);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const keys = useRef(new Set<string>());
  const map = useRef<HTMLDivElement>(null);
  const selected = scene.points.find(p => p.id === selectedId);
  const nearest = scene.points.filter(p => Math.hypot((p.position.x - pos.x) * size.width, (p.position.y - pos.y) * size.height) <= p.radius * Math.min(size.width, size.height))
    .sort((a, b) => Math.hypot((a.position.x - pos.x) * size.width, (a.position.y - pos.y) * size.height) - Math.hypot((b.position.x - pos.x) * size.width, (b.position.y - pos.y) * size.height))[0];
  useEffect(() => {
    const next = Object.fromEntries(Object.entries(assets).map(([path, blob]) => [path, URL.createObjectURL(blob)]));
    setUrls(next);
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url));
  }, [assets]);
  useEffect(() => {
    let frame = 0, previous = performance.now();
    function tick(now: number) {
      const seconds = Math.min((now - previous) / 1000, .05); previous = now;
      const k = keys.current;
      const dx = Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'));
      const dy = Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'));
      if (dx || dy) {
        const distance = seconds * .22 * Math.min(size.width, size.height) * (k.has('shift') ? 2 : 1) / Math.hypot(dx, dy);
        setPos(p => ({ x: Math.max(0, Math.min(1, p.x + dx * distance / size.width)), y: Math.max(0, Math.min(1, p.y + dy * distance / size.height)) }));
      }
      frame = requestAnimationFrame(tick);
    }
    const clear = () => keys.current.clear();
    const release = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear); window.addEventListener('keyup', release);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clear(); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); window.removeEventListener('keyup', release); };
  }, [size]);
  return <div className="scene-layout">
    <section className="scene-canvas-panel">
      <header><h2>{scene.name}</h2><span>{scene.points.length} 个交互点</span></header>
      <div className="scene-stage">
        <div ref={map} className="scene-map" role="region" aria-label="场景地图" tabIndex={0} style={{ width: `min(100%, ${64 * size.width / size.height}vh)` }}
          onPointerDown={event => { if (event.target === event.currentTarget || event.target instanceof HTMLImageElement) map.current?.focus(); }}
          onBlur={() => keys.current.clear()}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            const key = event.key.toLowerCase();
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'e'].includes(key)) event.preventDefault();
            if (key === 'e') { if (nearest) setSelectedId(nearest.id); }
            else keys.current.add(key);
          }}>
          {urls[scene.map] && <img src={urls[scene.map]} alt={`${scene.name}地图`} draggable={false} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}
          {scene.points.map((point, i) => <button key={point.id} className="scene-marker" aria-label={`地图地点：${point.name}`} title={point.name} aria-pressed={selectedId === point.id} style={{ left: `${point.position.x * 100}%`, top: `${point.position.y * 100}%` }} onClick={() => setSelectedId(point.id)}>{i + 1}</button>)}
          <span className="scene-player" aria-label="场景角色" data-x={pos.x} data-y={pos.y} style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}><CharacterPreview character={character} /></span>
        </div>
      </div>
      <div className="scene-map-help"><p>点击地图后用 WASD / 方向键移动，Shift 加速。{nearest ? `按 E 查看「${nearest.name}」` : '靠近地点按 E 交互。'}</p><p>也可以直接点击地图编号或右侧地点。当前只限制地图边界，建筑可穿行。</p></div>
    </section>
    <aside className="scene-details" aria-label="地点信息">
      <h2>探索地点</h2>
      <nav className="scene-point-list" aria-label="场景地点">{scene.points.map((point, i) => <button key={point.id} aria-label={`地点：${point.name}`} aria-pressed={selectedId === point.id} onClick={() => setSelectedId(point.id)}><b>{i + 1}</b><span>{point.name}<small>{featureNames[point.feature]}</small></span></button>)}</nav>
      {!scene.points.length && <p>这个包还没有交互点。</p>}
      {scene.points.length > 0 && !selected && <p className="scene-muted">选择一个地点，查看照片和互动内容。</p>}
      {selected && <PointDetails key={selected.id} point={selected} urls={urls} busy={busy} updatePoint={updatePoint} addPhoto={addPhoto} />}
    </aside>
  </div>;
}

function PointDetails({ point, urls, busy, updatePoint, addPhoto }: {
  point: ScenePoint; urls: Record<string, string>; busy: boolean;
  updatePoint: (point: ScenePoint) => Promise<void>; addPhoto: (point: ScenePoint, file?: File) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const courses = point.courses.filter(course => `${course.name} ${course.time} ${course.teacher}`.toLowerCase().includes(query.trim().toLowerCase()));
  function submit(event: FormEvent<HTMLFormElement>, kind: 'clubs' | 'reviews') {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (name: string) => String(data.get(name) ?? '').trim();
    if (kind === 'clubs' && get('name')) void updatePoint({ ...point, clubs: [...point.clubs, { name: get('name'), description: get('description') }] });
    if (kind === 'reviews' && get('author') && get('text')) void updatePoint({ ...point, reviews: [...point.reviews, { author: get('author'), text: get('text'), rating: Number(get('rating')) }] });
  }
  return <section className="scene-point-content">
    <span className="scene-eyebrow">{featureNames[point.feature]}</span><h3>{point.name}</h3>
    {point.feature === 'clubs' && <>
      {!point.clubs.length && <p>这里还没有社团。</p>}
      {point.clubs.map((club, i) => <article key={i}><h4>{club.name}</h4><p>{club.description}</p></article>)}
      <form onSubmit={e => submit(e, 'clubs')}><fieldset disabled={busy || point.clubs.length >= 500}><legend>添加社团</legend><label>社团名称<input name="name" required maxLength={80} /></label><label>社团介绍<textarea name="description" maxLength={2000} /></label><button>添加社团</button></fieldset></form>
    </>}
    {point.feature === 'reviews' && <>
      {!point.reviews.length && <p>这里还没有点评。</p>}
      {point.reviews.map((review, i) => <article key={i}><h4>{review.author} <span className="scene-rating">{'★'.repeat(review.rating)} <small>{review.rating}/5</small></span></h4><p>{review.text}</p></article>)}
      <form onSubmit={e => submit(e, 'reviews')}><fieldset disabled={busy || point.reviews.length >= 500}><legend>写点评</legend><label>点评昵称<input name="author" required maxLength={50} /></label><label>评分<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} 分</option>)}</select></label><label>点评内容<textarea name="text" required maxLength={2000} /></label><button>提交点评</button></fieldset></form>
    </>}
    {point.feature === 'timetable' && <><label>搜索课表<input value={query} onChange={e => setQuery(e.target.value)} placeholder="课程、时间或教师" /></label>{courses.map((course, i) => <article key={i}><h4>{course.name}</h4><p>{course.time}</p>{course.teacher && <p>{course.teacher}</p>}</article>)}{!courses.length && <p>{point.courses.length ? '没有匹配的课程。' : '这个地点还没有课表。'}</p>}</>}
    <div className="scene-photos"><h4>地点照片 · {point.photos.length}</h4>{point.photos.map((photo, i) => <figure key={i}><a href={urls[photo.path]} target="_blank" rel="noreferrer"><img src={urls[photo.path]} alt={photo.caption || `${point.name}照片 ${i + 1}`} loading="lazy" /></a>{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div>
    <label className="scene-photo-upload">上传地点照片<input aria-label="上传地点照片" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || point.photos.length >= 500} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void addPhoto(point, file); }} /></label>
  </section>;
}
