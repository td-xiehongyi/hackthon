/**
 * C：本地可视化内容编辑器 —— 维护社团与活动信息。
 *
 * 通过统一 PublicContentApi 读写，不直接落盘。保存使用 expectedRevision，
 * 命中 409 REVISION_CONFLICT 时保留草稿并提示核对，不自动重试覆盖。
 */
import { useEffect, useMemo, useState } from 'react';
import type {
  Activity,
  ApiError,
  CampusId,
  Club,
  PublicContent,
  PublicContentApi,
  PublicContentSnapshot,
  PublicLink,
} from '../stadium/types';
import { newId, parseContentJson, serializeContent, validateContent } from '../stadium/domain';
import './editor.css';

export interface ContentEditorProps {
  api: PublicContentApi;
  onRequestClose?: () => void;
  registerCloseGuard?: (guard: () => boolean | Promise<boolean>) => () => void;
}

type SaveStatus = 'loading' | 'editing' | 'saving' | 'saved' | 'error';

const CAMPUSES: CampusId[] = ['yuelushan', 'lunan', 'xiaoxiang'];
const CAMPUS_LABEL: Record<CampusId, string> = {
  yuelushan: '岳麓山校区',
  lunan: '麓南校区',
  xiaoxiang: '潇湘校区',
};

export default function ContentEditor({ api, onRequestClose, registerCloseGuard }: ContentEditorProps) {
  const [saved, setSaved] = useState<PublicContentSnapshot | null>(null);
  const [draft, setDraft] = useState<PublicContent | null>(null);
  const [status, setStatus] = useState<SaveStatus>('loading');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [editingClub, setEditingClub] = useState<{ mode: 'new' | 'edit'; club: Club } | null>(null);
  const [editingActivity, setEditingActivity] = useState<{ mode: 'new' | 'edit'; activity: Activity } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .read()
      .then((s) => {
        if (cancelled) return;
        setSaved(s);
        setDraft({ clubs: s.clubs, activities: s.activities });
        setStatus('editing');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
        setMessage('公共内容读取失败。');
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!registerCloseGuard) return;
    return registerCloseGuard(() => !dirty);
  }, [registerCloseGuard, dirty]);

  function mutate(fn: (d: PublicContent) => PublicContent) {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
    setStatus('editing');
    setMessage('');
  }

  function upsertClub(club: Club) {
    mutate((d) => {
      const exists = d.clubs.some((c) => c.id === club.id);
      return { ...d, clubs: exists ? d.clubs.map((c) => (c.id === club.id ? club : c)) : [...d.clubs, club] };
    });
    setEditingClub(null);
  }

  function deleteClub(id: string) {
    if (!draft) return;
    if (draft.activities.some((a) => a.organizerClubId === id)) {
      setMessage('该社团仍有活动引用，请先删除或改绑相关活动。');
      return;
    }
    mutate((d) => ({ ...d, clubs: d.clubs.filter((c) => c.id !== id) }));
  }

  function upsertActivity(activity: Activity) {
    mutate((d) => {
      const exists = d.activities.some((a) => a.id === activity.id);
      return {
        ...d,
        activities: exists
          ? d.activities.map((a) => (a.id === activity.id ? activity : a))
          : [...d.activities, activity],
      };
    });
    setEditingActivity(null);
  }

  function deleteActivity(id: string) {
    mutate((d) => ({ ...d, activities: d.activities.filter((a) => a.id !== id) }));
  }

  async function handleSave() {
    if (!saved || !draft) return;
    const errors = validateContent(draft);
    if (errors.length > 0) {
      setMessage(`校验未通过：${errors[0].message}${errors.length > 1 ? `（共 ${errors.length} 处）` : ''}`);
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      const result = await api.save({ expectedRevision: saved.revision, content: draft });
      setSaved(result);
      setDraft({ clubs: result.clubs, activities: result.activities });
      setDirty(false);
      setStatus('saved');
      setMessage('保存成功');
    } catch (e) {
      const err = e as ApiError;
      if (err?.error?.code === 'REVISION_CONFLICT') {
        setMessage('版本冲突：内容已被其他会话更新。草稿已保留，请「重新加载」核对后重试。');
      } else {
        setMessage(err?.error?.message ?? '保存失败');
      }
      setStatus('error');
    }
  }

  async function reloadLatest() {
    setStatus('loading');
    try {
      const s = await api.read();
      setSaved(s);
      setStatus('editing');
      setMessage('已加载最新内容，请核对你的草稿后重新保存。');
    } catch {
      setStatus('error');
      setMessage('重新加载失败。');
    }
  }

  function discardDraft() {
    if (!saved) return;
    setDraft({ clubs: saved.clubs, activities: saved.activities });
    setDirty(false);
    setMessage('已放弃未保存修改，恢复为已保存内容。');
  }

  function handleExport() {
    if (!draft) return;
    const blob = new Blob([serializeContent(draft)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `public-content-rev${saved?.revision ?? 0}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const text = await file.text();
    const parsed = parseContentJson(text);
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    const errors = validateContent(parsed.content);
    if (errors.length > 0) {
      setMessage(`导入内容校验未通过：${errors[0].message}${errors.length > 1 ? `（共 ${errors.length} 处）` : ''}`);
      return;
    }
    setDraft(parsed.content);
    setDirty(true);
    setStatus('editing');
    setMessage('已导入内容，请预览后点击「保存」。');
  }

  function handleClose() {
    if (dirty && !window.confirm('有未保存的修改，确定离开？')) return;
    onRequestClose?.();
  }

  const fieldErrors = useMemo(
    () => (draft ? validateContent(draft) : []),
    [draft],
  );

  if (status === 'loading') return <section className="ce-panel"><p className="ce-state">正在加载编辑器…</p></section>;
  if (!draft || !saved) {
    return (
      <section className="ce-panel">
        <p className="ce-state ce-error" role="alert">{message || '读取失败'}</p>
      </section>
    );
  }

  return (
    <section className="ce-panel">
      <header className="ce-header">
        <div>
          <p className="ce-eyebrow">本地内容维护</p>
          <h1>社团与活动编辑器</h1>
        </div>
        <div className="ce-actions">
          <button onClick={handleSave} disabled={status === 'saving'}>
            {status === 'saving' ? '保存中…' : '保存'}
          </button>
          <button onClick={handleExport}>导出</button>
          <label className="ce-import">
            导入
            <input type="file" accept="application/json,.json" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = '';
            }} />
          </label>
          {onRequestClose && <button onClick={handleClose}>关闭</button>}
        </div>
      </header>

      <div className="ce-statusbar">
        <span className={`ce-status ce-${status}`}>
          {status === 'saved' ? '已保存' : status === 'saving' ? '保存中' : status === 'error' ? '出错' : dirty ? '有未保存修改' : '已同步'}
        </span>
        <span>版本 revision {saved.revision}</span>
        {message && <span className="ce-message" role="status">{message}</span>}
      </div>

      {fieldErrors.length > 0 && (
        <ul className="ce-errors">
          {fieldErrors.slice(0, 6).map((e, i) => (
            <li key={i}><code>{e.path}</code>：{e.message}</li>
          ))}
          {fieldErrors.length > 6 && <li>…另有 {fieldErrors.length - 6} 处</li>}
        </ul>
      )}

      <div className="ce-columns">
        <ClubSection
          clubs={draft.clubs}
          editing={editingClub}
          onNew={() => setEditingClub({ mode: 'new', club: { id: newId(), name: '', category: '', summary: '', campusIds: [], links: [] } })}
          onEdit={(club) => setEditingClub({ mode: 'edit', club })}
          onCancel={() => setEditingClub(null)}
          onSubmit={upsertClub}
          onDelete={deleteClub}
        />
        <ActivitySection
          activities={draft.activities}
          clubs={draft.clubs}
          editing={editingActivity}
          onNew={() => setEditingActivity({ mode: 'new', activity: emptyActivity() })}
          onEdit={(activity) => setEditingActivity({ mode: 'edit', activity })}
          onCancel={() => setEditingActivity(null)}
          onSubmit={upsertActivity}
          onDelete={deleteActivity}
        />
      </div>

      {(status === 'error' || status === 'saved') && (
        <div className="ce-footer-actions">
          {status === 'error' && message.includes('版本冲突') && (
            <>
              <button onClick={reloadLatest}>重新加载最新内容</button>
              <button onClick={discardDraft}>放弃草稿</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function emptyActivity(): Activity {
  return {
    id: newId(),
    name: '',
    organizerClubId: '',
    category: '',
    startsAt: '',
    endsAt: '',
    campusId: null,
    venue: '',
    description: '',
    links: [],
  };
}

function ClubSection(props: {
  clubs: Club[];
  editing: { mode: 'new' | 'edit'; club: Club } | null;
  onNew: () => void;
  onEdit: (club: Club) => void;
  onCancel: () => void;
  onSubmit: (club: Club) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="ce-section">
      <div className="ce-section-head">
        <h2>社团（{props.clubs.length}）</h2>
        <button onClick={props.onNew}>+ 新增社团</button>
      </div>
      {props.editing && (
        <ClubForm
          key={props.editing.club.id}
          initial={props.editing.club}
          onCancel={props.onCancel}
          onSubmit={props.onSubmit}
        />
      )}
      <ul className="ce-list">
        {props.clubs.map((c) => (
          <li key={c.id}>
            <div className="ce-list-main">
              <strong>{c.name || '（未命名社团）'}</strong>
              <span className="ce-tag">{c.category || '未分类'}</span>
            </div>
            <div className="ce-list-actions">
              <button onClick={() => props.onEdit(c)}>编辑</button>
              <button className="ce-danger" onClick={() => props.onDelete(c.id)}>删除</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivitySection(props: {
  activities: Activity[];
  clubs: Club[];
  editing: { mode: 'new' | 'edit'; activity: Activity } | null;
  onNew: () => void;
  onEdit: (activity: Activity) => void;
  onCancel: () => void;
  onSubmit: (activity: Activity) => void;
  onDelete: (id: string) => void;
}) {
  const clubName = (id: string) => props.clubs.find((c) => c.id === id)?.name ?? `（${id}）`;
  return (
    <div className="ce-section">
      <div className="ce-section-head">
        <h2>活动（{props.activities.length}）</h2>
        <button onClick={props.onNew}>+ 新增活动</button>
      </div>
      {props.editing && (
        <ActivityForm
          key={props.editing.activity.id}
          initial={props.editing.activity}
          clubs={props.clubs}
          onCancel={props.onCancel}
          onSubmit={props.onSubmit}
        />
      )}
      <ul className="ce-list">
        {props.activities.map((a) => (
          <li key={a.id}>
            <div className="ce-list-main">
              <strong>{a.name || '（未命名活动）'}</strong>
              <span className="ce-tag">{clubName(a.organizerClubId)}</span>
            </div>
            <div className="ce-list-actions">
              <button onClick={() => props.onEdit(a)}>编辑</button>
              <button className="ce-danger" onClick={() => props.onDelete(a.id)}>删除</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClubForm({ initial, onCancel, onSubmit }: {
  initial: Club;
  onCancel: () => void;
  onSubmit: (club: Club) => void;
}) {
  const [club, setClub] = useState<Club>(initial);
  const toggleCampus = (c: CampusId) =>
    setClub((v) => ({ ...v, campusIds: v.campusIds.includes(c) ? v.campusIds.filter((x) => x !== c) : [...v.campusIds, c] }));

  return (
    <form className="ce-form" onSubmit={(e) => { e.preventDefault(); onSubmit(club); }}>
      <label>名称
        <input value={club.name} onChange={(e) => setClub({ ...club, name: e.target.value })} required />
      </label>
      <label>类别
        <input value={club.category} onChange={(e) => setClub({ ...club, category: e.target.value })} placeholder="如：科技学术 / 文化艺术" />
      </label>
      <label>简介
        <textarea value={club.summary} onChange={(e) => setClub({ ...club, summary: e.target.value })} />
      </label>
      <fieldset className="ce-campus">
        <legend>适用校区</legend>
        {CAMPUSES.map((c) => (
          <label key={c} className="ce-check">
            <input type="checkbox" checked={club.campusIds.includes(c)} onChange={() => toggleCampus(c)} />
            {CAMPUS_LABEL[c]}
          </label>
        ))}
      </fieldset>
      <LinksEditor links={club.links} onChange={(links) => setClub({ ...club, links })} />
      <div className="ce-form-actions">
        <button type="submit">保存社团</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function ActivityForm({ initial, clubs, onCancel, onSubmit }: {
  initial: Activity;
  clubs: Club[];
  onCancel: () => void;
  onSubmit: (activity: Activity) => void;
}) {
  const [a, setA] = useState<Activity>(initial);

  return (
    <form className="ce-form" onSubmit={(e) => { e.preventDefault(); onSubmit(a); }}>
      <label>名称
        <input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} required />
      </label>
      <label>类别
        <input value={a.category} onChange={(e) => setA({ ...a, category: e.target.value })} />
      </label>
      <label>主办社团
        <select value={a.organizerClubId} onChange={(e) => setA({ ...a, organizerClubId: e.target.value })} required>
          <option value="">请选择社团</option>
          {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <div className="ce-row">
        <label>开始时间
          <input type="datetime-local" value={toDatetimeLocal(a.startsAt)} onChange={(e) => setA({ ...a, startsAt: fromDatetimeLocal(e.target.value) })} />
        </label>
        <label>结束时间
          <input type="datetime-local" value={toDatetimeLocal(a.endsAt)} onChange={(e) => setA({ ...a, endsAt: fromDatetimeLocal(e.target.value) })} />
        </label>
      </div>
      <label>校区
        <select value={a.campusId ?? ''} onChange={(e) => setA({ ...a, campusId: (e.target.value || null) as CampusId | null })}>
          <option value="">未关联校区</option>
          {CAMPUSES.map((c) => <option key={c} value={c}>{CAMPUS_LABEL[c]}</option>)}
        </select>
      </label>
      <label>实际活动地点
        <input value={a.venue} onChange={(e) => setA({ ...a, venue: e.target.value })} placeholder="如：副场东侧 A 区摊位" />
      </label>
      <label>说明
        <textarea value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} />
      </label>
      <LinksEditor links={a.links} onChange={(links) => setA({ ...a, links })} />
      <div className="ce-form-actions">
        <button type="submit">保存活动</button>
        <button type="button" onClick={onCancel}>取消</button>
      </div>
    </form>
  );
}

function LinksEditor({ links, onChange }: { links: PublicLink[]; onChange: (l: PublicLink[]) => void }) {
  const update = (i: number, key: 'label' | 'url', value: string) =>
    onChange(links.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  const remove = (i: number) => onChange(links.filter((_, idx) => idx !== i));
  const add = () => onChange([...links, { label: '', url: '' }]);

  return (
    <div className="ce-links">
      <span className="ce-links-label">公开链接</span>
      {links.map((l, i) => (
        <div key={i} className="ce-link-row">
          <input placeholder="名称（可选）" value={l.label} onChange={(e) => update(i, 'label', e.target.value)} />
          <input placeholder="https://…" value={l.url} onChange={(e) => update(i, 'url', e.target.value)} />
          <button type="button" onClick={() => remove(i)}>删除</button>
        </div>
      ))}
      <button type="button" onClick={add}>+ 添加链接</button>
    </div>
  );
}

// datetime-local（浏览器本地时间）与 ISO 字符串互转；MVP 采用本地时区，接入真实数据时按契约复核时区规则。
function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocal(v: string): string {
  return v ? new Date(v).toISOString() : '';
}
