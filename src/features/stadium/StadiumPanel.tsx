/**
 * C：体育场（副场）地点功能页 —— 社团目录 + 活动查询 + 地点相册入口。
 *
 * 接收统一 PlacePanelProps（外加用于注入 API 的 api 属性）。
 * 相册复用 D 的 PlaceGallery，公共数据 API 由 A 的页面宿主注入。
 */
import { useEffect, useMemo, useState } from 'react';
import type {
  Activity,
  CampusId,
  Club,
  PlacePanelProps,
  PublicContentApi,
  PublicContentSnapshot,
} from './types';
import {
  STATUS_LABEL,
  activityStatus,
  filterActivities,
  filterClubs,
  formatTimeRange,
  uniqueCategories,
} from './domain';
import './stadium.css';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import CampusRun from './CampusRun';
import type { CharacterChoice } from '@/game/character/choices';

export interface StadiumPanelProps extends PlacePanelProps {
  api: PublicContentApi;
  characterChoice?: CharacterChoice;
}

type Tab = 'clubs' | 'activities' | 'gallery' | 'running';

const CAMPUS_OPTIONS: { value: CampusId | ''; label: string }[] = [
  { value: '', label: '全部校区' },
  { value: 'yuelushan', label: '岳麓山校区' },
  { value: 'lunan', label: '麓南校区' },
  { value: 'xiaoxiang', label: '潇湘校区' },
];

const CAMPUS_LABEL: Record<CampusId, string> = {
  yuelushan: '岳麓山校区',
  lunan: '麓南校区',
  xiaoxiang: '潇湘校区',
};

export default function StadiumPanel(props: StadiumPanelProps) {
  const { place, sessionId, api, onRequestClose } = props;
  const [snapshot, setSnapshot] = useState<PublicContentSnapshot | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [tab, setTab] = useState<Tab>('clubs');
  const [uploading, setUploading] = useState(false);
  useEffect(() => uploading ? props.registerCloseGuard(() => false) : undefined, [uploading, props.registerCloseGuard]);
  const [now, setNow] = useState(() => new Date());
  const [clubFilter, setClubFilter] = useState({ keyword: '', category: '', campusId: '' as CampusId | '' });
  const [activityFilter, setActivityFilter] = useState({
    keyword: '',
    category: '',
    campusId: '' as CampusId | '',
    date: '',
  });

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    api
      .read()
      .then((s) => {
        if (cancelled) return;
        setSnapshot(s);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
        setErrorMessage('公共内容读取失败，请稍后重试。');
      });
    return () => {
      cancelled = true;
    };
  }, [api, sessionId]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const clubs = useMemo(() => (snapshot ? filterClubs(snapshot.clubs, clubFilter) : []), [snapshot, clubFilter]);
  const activities = useMemo(
    () => (snapshot ? filterActivities(snapshot.activities, activityFilter) : []),
    [snapshot, activityFilter],
  );
  const clubCategories = useMemo(() => (snapshot ? uniqueCategories(snapshot.clubs) : []), [snapshot]);
  const activityCategories = useMemo(() => (snapshot ? uniqueCategories(snapshot.activities) : []), [snapshot]);
  const clubById = useMemo(() => {
    const m = new Map<string, Club>();
    snapshot?.clubs.forEach((c) => m.set(c.id, c));
    return m;
  }, [snapshot]);

  return (
    <section className="stadium-panel">
      <header className="sp-header">
        <div>
          <p className="sp-eyebrow">潇湘校区 · 互动地点</p>
          <h1>{place.name}</h1>
        </div>
        <button className="sp-back" onClick={onRequestClose}>返回校园</button>
      </header>

      <nav className="sp-tabs" role="tablist">
        <TabButton active={tab === 'running'} onClick={() => { if (!uploading) setTab('running'); }}>校园跑</TabButton>
        <TabButton active={tab === 'clubs'} onClick={() => { if (!uploading) setTab('clubs'); }}>社团目录</TabButton>
        <TabButton active={tab === 'activities'} onClick={() => { if (!uploading) setTab('activities'); }}>活动查询</TabButton>
        <TabButton active={tab === 'gallery'} onClick={() => setTab('gallery')}>地点相册</TabButton>
      </nav>

      {tab === 'running' && <CampusRun characterChoice={props.characterChoice} />}
      {tab !== 'running' && loadState === 'loading' && <p className="sp-state">正在加载社团与活动…</p>}
      {tab !== 'running' && loadState === 'error' && (
        <p className="sp-state sp-error" role="alert">{errorMessage}</p>
      )}

      {loadState === 'ready' && snapshot && (
        <>
          {tab === 'clubs' && (
            <ClubDirectory
              clubs={clubs}
              categories={clubCategories}
              filter={clubFilter}
              onFilter={setClubFilter}
            />
          )}
          {tab === 'activities' && (
            <ActivityDirectory
              activities={activities}
              categories={activityCategories}
              filter={activityFilter}
              onFilter={setActivityFilter}
              clubById={clubById}
              now={now}
            />
          )}
          {tab === 'gallery' && (
            <PlaceGallery placeId={place.placeId} onActivityChange={setUploading} />
          )}
        </>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`sp-tab${active ? ' is-active' : ''}`} role="tab" aria-selected={active} onClick={onClick}>
      {children}
    </button>
  );
}

function ClubDirectory({
  clubs,
  categories,
  filter,
  onFilter,
}: {
  clubs: Club[];
  categories: string[];
  filter: { keyword: string; category: string; campusId: CampusId | '' };
  onFilter: (f: { keyword: string; category: string; campusId: CampusId | '' }) => void;
}) {
  return (
    <div className="sp-body">
      <FilterBar
        keyword={filter.keyword}
        onKeyword={(v) => onFilter({ ...filter, keyword: v })}
        category={filter.category}
        categories={categories}
        onCategory={(v) => onFilter({ ...filter, category: v })}
        campusId={filter.campusId}
        onCampus={(v) => onFilter({ ...filter, campusId: v })}
        keywordPlaceholder="搜索社团名称 / 简介…"
      />
      {clubs.length === 0 ? (
        <p className="sp-empty">没有符合条件的社团。</p>
      ) : (
        <ul className="sp-list">
          {clubs.map((c) => (
            <li key={c.id}><ClubCard club={c} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityDirectory({
  activities,
  categories,
  filter,
  onFilter,
  clubById,
  now,
}: {
  activities: Activity[];
  categories: string[];
  filter: { keyword: string; category: string; campusId: CampusId | ''; date: string };
  onFilter: (f: { keyword: string; category: string; campusId: CampusId | ''; date: string }) => void;
  clubById: Map<string, Club>;
  now: Date;
}) {
  return (
    <div className="sp-body">
      <FilterBar
        keyword={filter.keyword}
        onKeyword={(v) => onFilter({ ...filter, keyword: v })}
        category={filter.category}
        categories={categories}
        onCategory={(v) => onFilter({ ...filter, category: v })}
        campusId={filter.campusId}
        onCampus={(v) => onFilter({ ...filter, campusId: v })}
        keywordPlaceholder="搜索活动 / 地点 / 说明…"
        extra={
          <input
            type="date"
            aria-label="按日期筛选"
            value={filter.date}
            onChange={(e) => onFilter({ ...filter, date: e.target.value })}
          />
        }
      />
      {activities.length === 0 ? (
        <p className="sp-empty">没有符合条件的活动。</p>
      ) : (
        <ul className="sp-list">
          {activities.map((a) => (
            <li key={a.id}><ActivityCard activity={a} clubById={clubById} now={now} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterBar(props: {
  keyword: string;
  onKeyword: (v: string) => void;
  category: string;
  categories: string[];
  onCategory: (v: string) => void;
  campusId: CampusId | '';
  onCampus: (v: CampusId | '') => void;
  keywordPlaceholder: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="sp-filters">
      <input
        type="search"
        placeholder={props.keywordPlaceholder}
        value={props.keyword}
        onChange={(e) => props.onKeyword(e.target.value)}
      />
      <select value={props.category} onChange={(e) => props.onCategory(e.target.value)}>
        <option value="">全部类别</option>
        {props.categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select value={props.campusId} onChange={(e) => props.onCampus(e.target.value as CampusId | '')}>
        {CAMPUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {props.extra}
    </div>
  );
}

function ClubCard({ club }: { club: Club }) {
  return (
    <article className="sp-card">
      <div className="sp-card-head">
        <h3>{club.name}</h3>
        <span className="sp-badge">{club.category}</span>
      </div>
      {club.summary && <p className="sp-summary">{club.summary}</p>}
      <p className="sp-meta">
        适用校区：{club.campusIds.length ? club.campusIds.map((c) => CAMPUS_LABEL[c]).join('、') : '未登记'}
      </p>
      {club.links.length > 0 && (
        <div className="sp-links">
          {club.links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a>
          ))}
        </div>
      )}
    </article>
  );
}

function ActivityCard({ activity, clubById, now }: { activity: Activity; clubById: Map<string, Club>; now: Date }) {
  const status = activityStatus(activity, now);
  const club = clubById.get(activity.organizerClubId);
  return (
    <article className="sp-card">
      <div className="sp-card-head">
        <h3>{activity.name}</h3>
        <span className={`sp-badge sp-status-${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <p className="sp-summary">
        <strong>主办社团：</strong>{club ? club.name : `（${activity.organizerClubId}）`}
      </p>
      <p className="sp-meta"><strong>时间：</strong>{formatTimeRange(activity.startsAt, activity.endsAt)}</p>
      <p className="sp-meta sp-venue"><strong>实际地点：</strong>{activity.venue || '未填写'}</p>
      {activity.description && <p className="sp-summary">{activity.description}</p>}
      {activity.links.length > 0 && (
        <div className="sp-links">
          {activity.links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a>
          ))}
        </div>
      )}
    </article>
  );
}
