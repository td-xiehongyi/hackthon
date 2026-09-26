import { useEffect, useMemo, useRef, useState } from 'react';
import './dormitory.css';

type DormBuilding = {
  id: string;
  label: string;
  subtitle: string;
  floors: number;
  residents: number;
  accent: string;
  note: string;
};

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  time: string;
  mine?: boolean;
  avatar: string;
};

type DormitoryState = {
  selectedBuildingId: string;
  joinedBuildingIds: string[];
  nickname: string;
  messages: Record<string, ChatMessage[]>;
};

const STORAGE_KEY = 'csu-shenghua-dormitory-v1';
const MAX_MESSAGE_LENGTH = 240;

/**
 * 当前地图只核验到“升华公寓组团”，楼栋清单保留为可替换的产品数据。
 * 一旦拿到现场核验结果，只需要替换这里，不会影响群聊和选择逻辑。
 */
const BUILDINGS: DormBuilding[] = [
  { id: 'shenghua-1', label: '1 栋', subtitle: '靠近半月湖', floors: 6, residents: 168, accent: '#d9a84e', note: '晚风和湖景都很近' },
  { id: 'shenghua-2', label: '2 栋', subtitle: '升华中庭', floors: 6, residents: 172, accent: '#719a78', note: '一楼有共享自习桌' },
  { id: 'shenghua-3', label: '3 栋', subtitle: '清水路侧', floors: 7, residents: 204, accent: '#5d8ba0', note: '出门就是主路和便利店' },
  { id: 'shenghua-4', label: '4 栋', subtitle: '南侧生活区', floors: 7, residents: 196, accent: '#a97963', note: '晚间相对安静' },
  { id: 'shenghua-5', label: '5 栋', subtitle: '中庭东侧', floors: 6, residents: 180, accent: '#8c80ab', note: '社团活动消息最集中' },
  { id: 'shenghua-6', label: '6 栋', subtitle: '中庭西侧', floors: 6, residents: 176, accent: '#7f9952', note: '离食堂步行约 5 分钟' },
  { id: 'shenghua-7', label: '7 栋', subtitle: '南门方向', floors: 7, residents: 210, accent: '#b46b62', note: '夜跑路线从门口经过' },
  { id: 'shenghua-8', label: '8 栋', subtitle: '组团最南侧', floors: 7, residents: 214, accent: '#6e8b9f', note: '公共晾晒区在东侧' },
];

const SEEDED_MESSAGES: Record<string, ChatMessage[]> = {
  'shenghua-1': [
    { id: '1-1', author: '林同学', body: '今晚 22:30 后有人一起去二食堂吗？', time: '18:42', avatar: '林' },
    { id: '1-2', author: '阿周', body: '我在！顺便帮忙带一份桂花冰豆花。', time: '18:45', avatar: '周' },
    { id: '1-3', author: '楼栋小助手', body: '本周三晚 19:00 中庭有失物招领，记得来看看。', time: '19:02', avatar: '助', mine: false },
  ],
  'shenghua-2': [
    { id: '2-1', author: '小满', body: '有人知道共享自习桌晚上几点关灯吗？', time: '17:18', avatar: '满' },
    { id: '2-2', author: '陈同学', body: '目前是 23:30，门禁照常走就好。', time: '17:21', avatar: '陈' },
  ],
  'shenghua-3': [
    { id: '3-1', author: '三栋管理员', body: '本周六上午检修热水，具体时间会在群里更新。', time: '09:10', avatar: '管' },
    { id: '3-2', author: '小叶', body: '收到，谢谢提醒！', time: '09:14', avatar: '叶' },
  ],
  'shenghua-4': [
    { id: '4-1', author: '周末电影局', body: '今晚 20:00 中庭投影《千与千寻》，欢迎带椅子来。', time: '16:30', avatar: '影' },
  ],
  'shenghua-5': [
    { id: '5-1', author: '摄影社 · 小顾', body: '周日沿玉带湖拍日落，有空位 3 个。', time: '12:06', avatar: '顾' },
    { id: '5-2', author: '阿棠', body: '报名一个！需要自带相机吗？', time: '12:09', avatar: '棠' },
  ],
  'shenghua-6': [
    { id: '6-1', author: '六栋值班室', body: '快递架已整理，取件请核对尾号。', time: '11:47', avatar: '值' },
  ],
  'shenghua-7': [
    { id: '7-1', author: '小马', body: '有人一起去看今晚的校队比赛吗？', time: '15:20', avatar: '马' },
  ],
  'shenghua-8': [
    { id: '8-1', author: '八栋生活委员', body: '东侧晾晒区今天风大，衣架记得夹牢。', time: '08:36', avatar: '生' },
  ],
};

function createInitialState(): DormitoryState {
  const fallback: DormitoryState = {
    selectedBuildingId: BUILDINGS[0].id,
    joinedBuildingIds: [],
    nickname: '我',
    messages: SEEDED_MESSAGES,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '') as Partial<DormitoryState>;
    const selectedBuildingId = BUILDINGS.some((building) => building.id === parsed.selectedBuildingId)
      ? parsed.selectedBuildingId!
      : fallback.selectedBuildingId;
    const joinedBuildingIds = Array.isArray(parsed.joinedBuildingIds)
      ? [...new Set(parsed.joinedBuildingIds.filter((id): id is string => BUILDINGS.some((building) => building.id === id)))]
      : [];
    const nickname = typeof parsed.nickname === 'string' && parsed.nickname.trim()
      ? parsed.nickname.trim().slice(0, 16)
      : fallback.nickname;
    const messages: Record<string, ChatMessage[]> = { ...SEEDED_MESSAGES };
    if (parsed.messages && typeof parsed.messages === 'object') {
      for (const building of BUILDINGS) {
        const candidate = parsed.messages[building.id];
        if (Array.isArray(candidate)) {
          messages[building.id] = candidate.filter((message): message is ChatMessage => (
            Boolean(message)
            && typeof message === 'object'
            && typeof message.id === 'string'
            && typeof message.author === 'string'
            && typeof message.body === 'string'
            && typeof message.time === 'string'
            && typeof message.avatar === 'string'
          )).slice(-80);
        }
      }
    }
    return { selectedBuildingId, joinedBuildingIds, nickname, messages };
  } catch {
    return fallback;
  }
}

function formatTime(date = new Date()): string {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fromRemoteMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.nickname !== 'string' || typeof item.text !== 'string' || typeof item.createdAt !== 'string') return null;
  const date = new Date(item.createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return {
    id: item.id,
    author: item.nickname,
    body: item.text,
    time: formatTime(date),
    avatar: item.nickname.slice(0, 1) || '邻',
  };
}

export default function DormitoryPage({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<DormitoryState>(createInitialState);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedBuilding = useMemo(
    () => BUILDINGS.find((building) => building.id === state.selectedBuildingId) ?? BUILDINGS[0],
    [state.selectedBuildingId],
  );
  const joined = state.joinedBuildingIds.includes(selectedBuilding.id);
  const messages = state.messages[selectedBuilding.id] ?? [];

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 浏览器禁用存储时，页面仍可作为当前会话聊天使用。
    }
  }, [state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedBuilding.id, messages.length]);

  // 开发服务提供一个本机 JSON 群聊接口；接口不可用时保留本地体验，
  // 这样静态预览和未启动服务的页面也不会被空白错误打断。
  useEffect(() => {
    if (!joined) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const response = await fetch(`/api/dorm-chat/${selectedBuilding.id}/messages`);
        if (!response.ok) return;
        const payload = await response.json() as { messages?: unknown[] };
        const remoteMessages = (payload.messages ?? []).map(fromRemoteMessage).filter((message): message is ChatMessage => message !== null);
        if (cancelled || remoteMessages.length === 0) return;
        setState((current) => {
          const localMessages = current.messages[selectedBuilding.id] ?? [];
          const byId = new Map(localMessages.map((message) => [message.id, message]));
          remoteMessages.forEach((message) => byId.set(message.id, { ...message, mine: message.author === current.nickname }));
          return {
            ...current,
            messages: { ...current.messages, [selectedBuilding.id]: [...byId.values()].slice(-80) },
          };
        });
      } catch {
        // 本机服务未启动时使用 localStorage 版本，不弹出阻断错误。
      }
    };
    void sync();
    const timer = window.setInterval(sync, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [joined, selectedBuilding.id]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as DormitoryState;
        if (next && typeof next === 'object' && BUILDINGS.some((building) => building.id === next.selectedBuildingId)) {
          setState(next);
        }
      } catch {
        // 忽略其他标签页写入的损坏数据。
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const selectBuilding = (id: string) => {
    setState((current) => ({ ...current, selectedBuildingId: id }));
    setDraft('');
    const building = BUILDINGS.find((item) => item.id === id);
    if (building) setNotice(`已切换到 ${building.label} 群聊`);
  };

  const joinSelectedBuilding = () => {
    setState((current) => ({
      ...current,
      joinedBuildingIds: current.joinedBuildingIds.includes(selectedBuilding.id)
        ? current.joinedBuildingIds
        : [...current.joinedBuildingIds, selectedBuilding.id],
    }));
    setNotice(`已加入升华公寓 ${selectedBuilding.label} 群聊`);
  };

  const leaveSelectedBuilding = () => {
    setState((current) => ({
      ...current,
      joinedBuildingIds: current.joinedBuildingIds.filter((id) => id !== selectedBuilding.id),
    }));
    setNotice(`已退出 ${selectedBuilding.label} 群聊；历史消息仍保存在本机`);
  };

  const sendMessage = () => {
    const body = draft.trim();
    if (!body || !joined) return;
    const message: ChatMessage = {
      id: `${selectedBuilding.id}-${Date.now()}`,
      author: state.nickname || '我',
      body: body.slice(0, MAX_MESSAGE_LENGTH),
      time: formatTime(),
      avatar: (state.nickname || '我').slice(0, 1),
      mine: true,
    };
    setState((current) => ({
      ...current,
      messages: {
        ...current.messages,
        [selectedBuilding.id]: [...(current.messages[selectedBuilding.id] ?? []), message].slice(-80),
      },
    }));
    setDraft('');
    setNotice('消息已发送');
    void fetch(`/api/dorm-chat/${selectedBuilding.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: message.id, nickname: message.author, text: message.body }),
    }).then((response) => {
      if (!response.ok) setNotice('消息已保存在本机（群聊服务暂不可用）');
    }).catch(() => setNotice('消息已保存在本机（群聊服务暂不可用）'));
  };

  const saveNickname = () => {
    const nickname = nicknameDraft.trim().slice(0, 16);
    if (!nickname) {
      setNotice('昵称不能为空');
      return;
    }
    setState((current) => ({ ...current, nickname }));
    setProfileOpen(false);
    setNotice(`昵称已改为“${nickname}”`);
  };

  return (
    <main className="dorm-page">
      <header className="dorm-header">
        <button type="button" className="dorm-back" onClick={onBack}>
          <span aria-hidden="true">←</span> 返回校园
        </button>
        <div className="dorm-brand-mark" aria-hidden="true">宿</div>
        <div className="dorm-heading">
          <p>LN · SHENGHUA RESIDENCE</p>
          <h1>升华公寓 · 楼栋群聊</h1>
        </div>
        <div className="dorm-header-actions">
          <span className="dorm-live"><i /> 本机群聊体验版</span>
          <button
            type="button"
            className="dorm-profile-button"
            aria-expanded={profileOpen}
            onClick={() => { setNicknameDraft(state.nickname); setProfileOpen((open) => !open); }}
          >
            <span className="dorm-avatar small">{state.nickname.slice(0, 1)}</span>
            {state.nickname}
          </button>
        </div>
        {profileOpen && (
          <form className="dorm-profile-popover" onSubmit={(event) => { event.preventDefault(); saveNickname(); }}>
            <label htmlFor="dorm-nickname">群聊昵称</label>
            <input id="dorm-nickname" value={nicknameDraft} maxLength={16} onChange={(event) => setNicknameDraft(event.target.value)} autoFocus />
            <button type="submit">保存昵称</button>
          </form>
        )}
      </header>

      <section className="dorm-intro" aria-labelledby="dorm-intro-title">
        <div>
          <p className="dorm-kicker">麓南校区 · 升华公寓组团</p>
          <h2 id="dorm-intro-title">先选楼栋，<br />再和邻居聊两句。</h2>
          <p className="dorm-intro-copy">每栋楼都有独立群聊。选择你住的楼栋后加入，门禁提醒、拼车、失物招领和临时约饭都能在这里找到。</p>
        </div>
        <div className="dorm-hero-card" style={{ '--dorm-accent': selectedBuilding.accent } as React.CSSProperties}>
          <span className="dorm-hero-label">当前选择</span>
          <strong>{selectedBuilding.label}</strong>
          <span>{selectedBuilding.subtitle}</span>
          <div className="dorm-hero-stats"><span>{selectedBuilding.floors} 层</span><span>约 {selectedBuilding.residents} 人</span><span>{joined ? '已加入' : '未加入'}</span></div>
        </div>
      </section>

      <div className="dorm-workspace">
        <aside className="dorm-building-panel" aria-label="升华公寓楼栋选择">
          <div className="dorm-panel-heading">
            <div><span>01 / BUILDINGS</span><h2>我的楼栋</h2></div>
            <span className="dorm-count">{state.joinedBuildingIds.length}/{BUILDINGS.length} 已加入</span>
          </div>
          <label className="dorm-mobile-select" htmlFor="dorm-building-select">选择楼栋
            <select id="dorm-building-select" value={selectedBuilding.id} onChange={(event) => selectBuilding(event.target.value)}>
              {BUILDINGS.map((building) => <option key={building.id} value={building.id}>{building.label} · {building.subtitle}</option>)}
            </select>
          </label>
          <div className="dorm-building-list">
            {BUILDINGS.map((building) => {
              const active = building.id === selectedBuilding.id;
              const isJoined = state.joinedBuildingIds.includes(building.id);
              return (
                <button
                  type="button"
                  key={building.id}
                  className={`dorm-building-card${active ? ' active' : ''}`}
                  aria-pressed={active}
                  onClick={() => selectBuilding(building.id)}
                >
                  <span className="dorm-building-number" style={{ '--dorm-accent': building.accent } as React.CSSProperties}>{building.label.replace(' 栋', '')}</span>
                  <span className="dorm-building-copy"><strong>{building.label}</strong><small>{building.subtitle}</small></span>
                  {isJoined ? <span className="dorm-joined-mark" title="已加入">✓</span> : <span className="dorm-building-arrow" aria-hidden="true">↗</span>}
                </button>
              );
            })}
          </div>
          <p className="dorm-panel-note">楼栋编号是当前体验版目录，后续可按公寓现场核验结果更新；你的选择只保存在本浏览器。</p>
        </aside>

        <section className="dorm-chat-panel" aria-label={`${selectedBuilding.label}群聊`}>
          <header className="dorm-chat-head">
            <div className="dorm-chat-title"><span className="dorm-hash">#</span><div><h2>升华公寓 · {selectedBuilding.label}群</h2><p>{selectedBuilding.note} · {selectedBuilding.residents} 位邻居</p></div></div>
            <div className="dorm-chat-actions">
              <span className={joined ? 'dorm-room-status joined' : 'dorm-room-status'}><i /> {joined ? '已加入' : '待加入'}</span>
              {joined && <button type="button" className="dorm-leave-button" onClick={leaveSelectedBuilding}>退出群聊</button>}
            </div>
          </header>

          {!joined ? (
            <div className="dorm-chat-gate">
              <div className="dorm-gate-icon" aria-hidden="true">{selectedBuilding.label.replace(' 栋', '')}</div>
              <p className="dorm-kicker">YOUR ROOM, YOUR PEOPLE</p>
              <h3>加入 {selectedBuilding.label} 群聊</h3>
              <p>加入后可以查看楼栋消息、发送文字，也可以随时切换到其他楼栋浏览公开群聊。</p>
              <button type="button" className="dorm-primary-button" onClick={joinSelectedBuilding}>加入 {selectedBuilding.label} 群聊</button>
              <small>只会保存到当前浏览器，不需要账号。</small>
            </div>
          ) : (
            <>
              <div className="dorm-message-list" role="log" aria-live="polite" aria-label={`${selectedBuilding.label}消息列表`}>
                <div className="dorm-day-divider"><span>今天</span></div>
                {messages.map((message) => (
                  <article className={`dorm-message${message.mine ? ' mine' : ''}`} key={message.id}>
                    <span className="dorm-avatar" style={{ '--dorm-accent': message.mine ? selectedBuilding.accent : undefined } as React.CSSProperties}>{message.avatar}</span>
                    <div className="dorm-message-body">
                      <div className="dorm-message-meta"><strong>{message.mine ? state.nickname : message.author}</strong><time>{message.time}</time></div>
                      <p>{message.body}</p>
                    </div>
                  </article>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <form className="dorm-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
                <label htmlFor="dorm-message" className="visually-hidden">发送消息</label>
                <textarea
                  id="dorm-message"
                  value={draft}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={`在 ${selectedBuilding.label} 群里说点什么…`}
                  rows={2}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="dorm-composer-foot"><span>{draft.length}/{MAX_MESSAGE_LENGTH} · Enter 发送，Shift + Enter 换行</span><button type="submit" className="dorm-send-button" disabled={!draft.trim()}>发送 <span aria-hidden="true">↗</span></button></div>
              </form>
            </>
          )}
        </section>
      </div>
      <p className="dorm-notice" role="status" aria-live="polite">{notice}</p>
      <footer className="dorm-footer"><span>灵感参考：ChatUI / Chat UI Kit 的会话列表与消息输入结构</span><span>消息优先保存到本机群聊服务；服务离线时退回浏览器本地</span></footer>
    </main>
  );
}
