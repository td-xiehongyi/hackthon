import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatParkingDuration,
  PARKING_PORTS,
  statusLabel,
  type ParkingPort,
  type ParkingPortStatus,
} from './parkingData';
import './parking.css';

export type ParkingFilter = 'all' | ParkingPortStatus;

export interface ParkingStatusUpdate {
  deviceNumber: string;
  status: ParkingPortStatus;
  remainingSeconds?: number;
}

export interface ParkingStatusResponse {
  live?: boolean;
  source?: string;
  updatedAt?: string;
  data?: ParkingStatusUpdate[];
  message?: string;
}

export interface ParkingPanelProps {
  /** Override the photo snapshot in tests or when a live adapter is available. */
  ports?: readonly ParkingPort[];
  /** Optional return action supplied by the teaching-building host page. */
  onBack?: () => void;
  /**
   * Opt-in status endpoint. It is disabled by default so the photo snapshot is
   * never presented as real-time data without an explicit integration.
   */
  statusEndpoint?: string;
  /** Poll the endpoint every 15 seconds when `statusEndpoint` is supplied. */
  pollLive?: boolean;
}

const normalizeStatus = (value: unknown): ParkingPortStatus | null => {
  const text = String(value ?? '').trim().toLowerCase();
  if (['available', 'free', 'idle', '空闲', '未占用', '可用', '0'].includes(text)) return 'available';
  if (['occupied', 'busy', 'charging', 'in_use', 'inuse', '占用', '占用中', '1'].includes(text)) return 'occupied';
  return null;
};

const formatUpdatedAt = (value?: string) => {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更新时间未知';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const clonePorts = (ports: readonly ParkingPort[]): ParkingPort[] => ports.map((port) => ({ ...port }));
const RESERVATION_KEY = 'csu-campus-parking-reservation';

/**
 * Teaching-building parking/charging dashboard.
 *
 * The initial state is the QR-photo snapshot. Occupied cards count down in the
 * browser as a demonstration; the banner deliberately names this as non-live
 * until a caller opts into `statusEndpoint` + `pollLive`.
 */
export default function ParkingPanel({
  ports = PARKING_PORTS,
  onBack,
  statusEndpoint = '/api/parking/status',
  pollLive = true,
}: ParkingPanelProps) {
  const [portState, setPortState] = useState<ParkingPort[]>(() => clonePorts(ports));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ParkingFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState('照片快照 · 演示倒计时 · 非实时');
  const [reservedId, setReservedId] = useState<string | null>(() => {
    try {
      const stored = window.localStorage.getItem(RESERVATION_KEY);
      return stored && ports.some((port) => port.id === stored) ? stored : null;
    } catch { return null; }
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setPortState(clonePorts(ports));
  }, [ports]);

  // Advance the demonstration countdown once per second. A live payload may
  // refresh the values in the separate polling effect below.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPortState((current) => current.map((port) => {
        if (port.status !== 'occupied' || port.remainingSeconds <= 0) return port;
        const remainingSeconds = port.remainingSeconds - 1;
        return remainingSeconds > 0
          ? { ...port, remainingSeconds }
          : { ...port, status: 'available', remainingSeconds: 0 };
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pollLive || !statusEndpoint) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch(`${statusEndpoint}${statusEndpoint.includes('?') ? '&' : '?'}t=${Date.now()}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json() as ParkingStatusResponse;
        if (cancelled) return;
        let applied = 0;
        const updates = Array.isArray(payload.data) ? payload.data : [];
        setPortState((current) => current.map((port) => {
          const update = updates.find((item) => String(item.deviceNumber) === port.id);
          const nextStatus = normalizeStatus(update?.status);
          if (!update || !nextStatus) return port;
          applied += 1;
          const remaining = Number(update.remainingSeconds ?? 0);
          return {
            ...port,
            status: nextStatus,
            remainingSeconds: Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : 0,
          };
        }));
        if (payload.live === true && applied > 0) {
          setLive(true);
          setUpdatedAt(payload.updatedAt || new Date().toISOString());
          setStatusMessage(`实时同步 · ${formatUpdatedAt(payload.updatedAt || new Date().toISOString())}`);
        } else {
          setLive(false);
          setStatusMessage(payload.message || '接口暂无实时数据，当前显示照片快照');
        }
      } catch {
        if (cancelled) return;
        setLive(false);
        setStatusMessage('实时接口不可用，当前显示照片快照 · 非实时');
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollLive, statusEndpoint]);

  useEffect(() => {
    if (!selectedId) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
  }, [selectedId]);

  const selectedPort = useMemo(
    () => portState.find((port) => port.id === selectedId) ?? null,
    [portState, selectedId],
  );

  const filteredPorts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    return portState.filter((port) => {
      if (filter !== 'all' && port.status !== filter) return false;
      if (!normalizedQuery) return true;
      return [String(port.order), port.id, port.payload, port.photo, port.source]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedQuery);
    });
  }, [filter, portState, query]);

  const availableCount = portState.filter((port) => port.status === 'available').length;
  const occupiedCount = portState.filter((port) => port.status === 'occupied').length;

  const openDetails = (port: ParkingPort) => setSelectedId(port.id);
  const closeDetails = () => setSelectedId(null);
  const toggleReservation = (port: ParkingPort) => {
    const next = reservedId === port.id ? null : port.id;
    setReservedId(next);
    try {
      if (next) window.localStorage.setItem(RESERVATION_KEY, next);
      else window.localStorage.removeItem(RESERVATION_KEY);
    } catch { /* local storage is optional */ }
    setStatusMessage(next ? `已在本机标记 ${port.order} 号端口 · 仅供演示` : '已取消本机端口标记');
  };

  return (
    <section className="parking-panel" aria-labelledby="parking-title">
      <header className="parking-header">
        <div className="parking-heading">
          <div className="parking-mark" aria-hidden="true">停</div>
          <div>
            <p className="parking-kicker">潇湘校区 · 教学楼群</p>
            <h1 id="parking-title">停车场 / 充电位</h1>
            <p className="parking-subtitle">按二维码照片顺序查看每个设备的占用状态与剩余时间。</p>
          </div>
        </div>
        {onBack && <button type="button" className="parking-back" onClick={onBack}>返回教学楼</button>}
      </header>

      <section className={`parking-signal ${live ? 'is-live' : ''}`} aria-live="polite">
        <span className="parking-signal-dot" aria-hidden="true" />
        <div>
          <strong>{live ? '实时状态' : '照片状态'}</strong>
          <span>{statusMessage}</span>
        </div>
        {updatedAt && <time dateTime={updatedAt}>更新于 {formatUpdatedAt(updatedAt)}</time>}
      </section>

      <section className="parking-overview" aria-label="停车位概览">
        <div className="parking-stat parking-stat-available">
          <span className="parking-stat-label">未占用</span>
          <strong>{availableCount}</strong>
          <span>个端口可用</span>
        </div>
        <div className="parking-stat parking-stat-occupied">
          <span className="parking-stat-label">占用中</span>
          <strong>{occupiedCount}</strong>
          <span>个端口使用中</span>
        </div>
        <div className="parking-stat parking-stat-total">
          <span className="parking-stat-label">全部端口</span>
          <strong>{portState.length}</strong>
          <span>按照片顺序编号</span>
        </div>
      </section>

      <section className="parking-toolbar" aria-label="筛选停车位">
        <label className="parking-search">
          <span aria-hidden="true">⌕</span>
          <span className="visually-hidden">搜索端口</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索端口编号或二维码内容"
            aria-label="搜索端口编号或二维码内容"
          />
          {query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}>×</button>}
        </label>
        <div className="parking-filters" role="group" aria-label="状态筛选">
          {([
            ['all', '全部'],
            ['available', '未占用'],
            ['occupied', '占用中'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : ''}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <p className="parking-result-count" aria-live="polite">
        显示 {filteredPorts.length} / {portState.length} 个端口 · 点击按钮查看详情
      </p>

      {filteredPorts.length > 0 ? (
        <ol className="parking-grid" aria-label="充电端口列表">
          {filteredPorts.map((port) => (
            <li key={port.id}>
              <button
                type="button"
                className={`parking-card parking-card-${port.status}`}
                onClick={() => openDetails(port)}
                aria-label={`${port.order} 号端口，${statusLabel(port.status)}${port.status === 'occupied' ? `，剩余 ${formatParkingDuration(port.remainingSeconds)}` : ''}`}
              >
                <span className="parking-card-topline">
                  <span className="parking-sequence">{String(port.order).padStart(2, '0')}</span>
                  <span className="parking-status"><i aria-hidden="true" />{statusLabel(port.status)}</span>
                </span>
                <span className="parking-card-title">{port.order} 号充电位</span>
                <span className="parking-card-id">{port.id}</span>
                {reservedId === port.id && <span className="parking-card-reserved">本机已标记</span>}
                <span className="parking-card-bottomline">
                  <span>{port.status === 'occupied' ? '预计剩余' : '当前状态'}</span>
                  <strong>{port.status === 'occupied' ? formatParkingDuration(port.remainingSeconds) : '现在可用'}</strong>
                </span>
                <span className="parking-card-action">查看详情 <span aria-hidden="true">↗</span></span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <section className="parking-empty" aria-live="polite">
          <strong>没有符合条件的端口</strong>
          <p>试试清空搜索，或切换到“全部”状态。</p>
          <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>清除筛选</button>
        </section>
      )}

      <footer className="parking-footnote">
        <span>数据来源：二维码照片识别结果</span>
        <span>状态为演示快照，不代表实时占用；剩余时间仅用于界面演示。</span>
      </footer>

      {selectedPort && (
        <div className="parking-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails(); }}>
          <div ref={dialogRef} className="parking-dialog" role="dialog" aria-modal="true" aria-labelledby="parking-dialog-title" tabIndex={-1}>
            <header className="parking-dialog-header">
              <div>
                <span className="parking-dialog-sequence">端口 {String(selectedPort.order).padStart(2, '0')}</span>
                <h2 id="parking-dialog-title">{selectedPort.order} 号充电位</h2>
              </div>
              <button type="button" className="parking-dialog-close" data-dialog-initial-focus aria-label="关闭端口详情" onClick={closeDetails}>×</button>
            </header>
            <div className={`parking-dialog-status parking-dialog-status-${selectedPort.status}`}>
              <span className="parking-dialog-status-dot" aria-hidden="true" />
              <strong>{statusLabel(selectedPort.status)}</strong>
              <span>{selectedPort.status === 'occupied' ? '剩余时间' : '可立即使用'}</span>
              {selectedPort.status === 'occupied' && <time>{formatParkingDuration(selectedPort.remainingSeconds)}</time>}
            </div>
            <dl className="parking-detail-list">
              <div><dt>设备编号</dt><dd>{selectedPort.id}</dd></div>
              <div><dt>识别状态</dt><dd>{selectedPort.payloadStatus}</dd></div>
              <div><dt>照片顺序</dt><dd>{selectedPort.photo}</dd></div>
              <div><dt>完整二维码内容</dt><dd className="parking-payload">{selectedPort.payload}</dd></div>
            </dl>
            <p className="parking-dialog-source">{selectedPort.source}</p>
            <p className="parking-dialog-note">当前状态来自照片快照；倒计时在此页面中按秒演示，不会改变真实设备。</p>
            <footer className="parking-dialog-actions">
              <button type="button" className="parking-dialog-secondary" onClick={closeDetails}>关闭</button>
              {selectedPort.status === 'available' && <button type="button" className="parking-dialog-secondary" onClick={() => toggleReservation(selectedPort)}>{reservedId === selectedPort.id ? '取消本机标记' : '标记为待用'}</button>}
              <button type="button" className="parking-dialog-primary" onClick={() => { void navigator.clipboard?.writeText(selectedPort.payload).catch(() => undefined); }}>复制二维码内容</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
