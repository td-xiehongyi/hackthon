import { useEffect, useRef, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import { averageRating, CANTEEN_FLOORS, type CanteenWindow, type PublishedCanteenReview } from './data';
import { loadReviews, publishReview } from './reviews-api';
import './canteen.css';

function WindowImage({ window }: { window: CanteenWindow }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className="canteen-image-missing" role="img" aria-label={`${window.name}图片待补充`}>窗口图片待补充</div>
    : <img src={window.image} alt={`${window.name}窗口示意图`} onError={() => setFailed(true)} />;
}

interface ReviewDraft { author: string; rating: number; text: string; id: string }

export default function CanteenPanel({ onRequestClose, registerCloseGuard }: PlacePanelProps) {
  const [floorLevel, setFloorLevel] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishedCanteenReview[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const lastCard = useRef<HTMLButtonElement | null>(null);
  const floor = CANTEEN_FLOORS.find((item) => item.level === floorLevel)!;
  const selected = floor.windows.find((window) => window.id === selectedId);
  const selectedReviews = published.filter(review => review.windowId === selectedId);
  const draft = selectedId ? drafts[selectedId] : undefined;
  const hasDraft = Object.values(drafts).some(value => value.text.trim() || value.author.trim() || value.rating !== 5);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    void loadReviews().then(result => {
      if (active) { setPublished(result.reviews); setLoadState('ready'); setLoadError(''); }
    }).catch(error => { if (active) { setLoadState('error'); setLoadError(error.message); } });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => registerCloseGuard(() => !saving && (!hasDraft || window.confirm('还有未发布的评价。确定放弃草稿并返回校园吗？'))), [registerCloseGuard, saving, hasDraft]);
  useEffect(() => {
    if (!hasDraft && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft, saving]);

  function summary(window: CanteenWindow): string {
    const actual = published.filter(review => review.windowId === window.id);
    if (loadState !== 'ready') return loadState === 'loading' ? '评价加载中…' : '评价暂未读取';
    return actual.length ? `★ ${averageRating(actual)} · ${actual.length} 条评价`
      : window.reviews.length ? `★ ${averageRating(window.reviews)} · ${window.reviews.length} 条示例评价` : '暂无评价';
  }

  function updateDraft(patch: Partial<ReviewDraft>) {
    if (!selectedId || !draft) return;
    setDrafts(current => ({ ...current, [selectedId]: { ...draft, ...patch, id: crypto.randomUUID() } }));
    setSaveError('');
  }

  async function submitReview() {
    if (!selectedId || !draft || saving || !draft.text.trim()) return;
    setSaving(true); setSaveError(''); setSaveMessage('');
    try {
      const saved = await publishReview({ ...draft, windowId: selectedId, author: draft.author.trim() || '匿名同学', text: draft.text.trim() });
      setPublished(current => [saved, ...current.filter(review => review.id !== saved.id)]);
      setDrafts(current => { const next = { ...current }; delete next[saved.windowId]; return next; });
      setSaveMessage('评价已保存，下次打开仍可查看。');
    } catch (error) { setSaveError(error instanceof Error ? error.message : '评价保存失败，请重试。'); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (selectedId) detailTitle.current?.focus();
    setSaveError(''); setSaveMessage('');
  }, [selectedId]);

  return <section className="canteen-panel" aria-labelledby="canteen-title">
    <header className="canteen-header">
      <div><span className="canteen-eyebrow">麓南校区 · 校园食光</span><h1 id="canteen-title">二食堂</h1><p>上几楼，吃点什么？</p></div>
      <button type="button" className="canteen-back" disabled={saving} onClick={onRequestClose}>返回校园</button>
    </header>
    <p className="canteen-demo-note">示例体验：窗口名称、楼层分布和插画为演示内容。示例评价已单独标注，你发布的评价会保存。</p>
    {loadState === 'loading' && <p className="canteen-service-note" role="status">正在读取已保存的评价…</p>}
    {loadState === 'error' && <div className="canteen-service-note" role="alert">{loadError}<button type="button" onClick={() => setReload(value => value + 1)}>重新读取</button></div>}
    <nav className="canteen-floors" aria-label="选择食堂楼层">
      {CANTEEN_FLOORS.map((item) => <button key={item.level} type="button" disabled={saving} aria-pressed={floorLevel === item.level}
        onClick={() => { setFloorLevel(item.level); setSelectedId(null); }}>
        <span aria-hidden="true">0{item.level}</span><strong>{item.level} 楼</strong>
      </button>)}
    </nav>
    <div className="canteen-body">
      {selected ? <section className="canteen-detail" aria-labelledby="canteen-window-title">
        <button type="button" className="canteen-list-back" disabled={saving} onClick={() => {
          setSelectedId(null);
          requestAnimationFrame(() => lastCard.current?.focus());
        }}>← 返回 {floorLevel} 楼窗口</button>
        <div className="canteen-detail-heading">
          <WindowImage key={selected.id} window={selected} />
          <div><span className="canteen-eyebrow">{floorLevel} 楼 · 示例窗口</span>
            <h2 id="canteen-window-title" ref={detailTitle} tabIndex={-1}>{selected.name}</h2><p>{selected.specialty}</p>
            <div className="canteen-score"><strong>{loadState === 'ready' ? averageRating(selectedReviews.length ? selectedReviews : selected.reviews) ?? '暂无评分' : '—'}</strong>
              {(selectedReviews.length > 0 || selected.reviews.length > 0) && <span>/ 5 · {selectedReviews.length ? `${selectedReviews.length} 条评价` : `${selected.reviews.length} 条示例评价`}</span>}</div>
          </div>
        </div>
        <div className="canteen-review-heading"><h3>窗口评价</h3><button type="button" disabled={loadState !== 'ready' || saving || !!draft} onClick={() => {
          setDrafts(current => ({ ...current, [selected.id]: { author: '', rating: 5, text: '', id: crypto.randomUUID() } }));
          setSaveError(''); setSaveMessage('');
        }}>写评价</button></div>
        <p className="canteen-save-hint">发布后保存到本机校园应用，下次打开仍可查看。</p>
        {draft && <form className="canteen-review-form" aria-label={`评价${selected.name}`} onSubmit={event => { event.preventDefault(); void submitReview(); }}>
          <fieldset disabled={saving}>
            <legend>说说你在{selected.name}的用餐体验</legend>
            <div className="canteen-review-fields"><label>昵称（选填）<input maxLength={30} value={draft.author} placeholder="不填写则显示匿名同学" onChange={event => updateDraft({ author: event.target.value })} /></label>
              <label>评分<select value={draft.rating} onChange={event => updateDraft({ rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} 分 {'★'.repeat(rating)}</option>)}</select></label></div>
            <label>评价内容<textarea autoFocus required maxLength={1000} rows={4} value={draft.text} placeholder="口味、分量、服务，有什么想分享的？" onChange={event => updateDraft({ text: event.target.value })} /></label>
            <div className="canteen-form-footer"><span>{draft.text.length} / 1000</span><div>
              <button type="button" onClick={() => {
                if ((draft.text.trim() || draft.author.trim() || draft.rating !== 5) && !window.confirm('确定放弃这条未发布的评价吗？')) return;
                setDrafts(current => { const next = { ...current }; delete next[selected.id]; return next; }); setSaveError('');
              }}>取消</button><button type="submit" disabled={!draft.text.trim()}>{saving ? '正在保存…' : '发布评价'}</button>
            </div></div>
          </fieldset>
          {saveError && <p role="alert" className="canteen-save-error">{saveError}</p>}
        </form>}
        {saveMessage && <p className="canteen-saved" role="status">{saveMessage}</p>}
        {selectedReviews.length > 0 && <ul className="canteen-reviews canteen-published">{[...selectedReviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(review => <li key={review.id}>
          <div><strong>{review.author}</strong><span aria-label={`${review.rating} 分，满分 5 分`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
          <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
          <p>{review.text}</p>
        </li>)}</ul>}
        {selected.reviews.length > 0 && <><h3>示例评价</h3><ul className="canteen-reviews">{selected.reviews.map((review) => <li key={review.id}>
          <div><strong>{review.author}</strong><span aria-label={`${review.rating} 分，满分 5 分`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>
          <p>{review.text}</p>
        </li>)}</ul></>}
        {loadState === 'ready' && !selectedReviews.length && !selected.reviews.length && <p className="canteen-empty">暂无评价，等你发现这个窗口的味道。</p>}
      </section> : <section aria-labelledby="canteen-floor-title">
        <div className="canteen-floor-heading"><div><h2 id="canteen-floor-title">{floorLevel} 楼窗口</h2><p>{floor.subtitle}</p></div><span>{floor.windows.length} 个示例窗口</span></div>
        <div className="canteen-windows">{floor.windows.map((window, index) => <button type="button" key={window.id}
          ref={(element) => { if (element && window.id === lastCard.current?.dataset.windowId) lastCard.current = element; }}
          data-window-id={window.id} className="canteen-window" aria-label={`查看${window.name}评价`}
          onClick={(event) => { lastCard.current = event.currentTarget; setSelectedId(window.id); }}>
          <div className="canteen-window-image"><WindowImage window={window} /><span>{floorLevel}F · {String(index + 1).padStart(2, '0')}</span></div>
          <div className="canteen-window-content"><h3>{window.name}</h3><p>{window.specialty}</p>
            <div className="canteen-window-footer"><span>{summary(window)}</span><strong>查看评价 ↗</strong></div>
          </div>
        </button>)}</div>
        {floor.windows.length === 0 && <p className="canteen-empty">本层窗口资料待补充。</p>}
      </section>}
    </div>
  </section>;
}
