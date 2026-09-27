import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export type ParkingRefreshInterval = 0 | 15 | 30 | 60;

export const PARKING_REFRESH_INTERVALS: readonly ParkingRefreshInterval[] = [0, 15, 30, 60];

export const refreshIntervalLabel = (value: ParkingRefreshInterval): string => {
  if (value === 0) return '暂停自动刷新';
  return `每 ${value} 秒`;
};

export const parseRefreshInterval = (value: string): ParkingRefreshInterval => {
  const parsed = Number(value);
  return PARKING_REFRESH_INTERVALS.includes(parsed as ParkingRefreshInterval)
    ? parsed as ParkingRefreshInterval
    : 15;
};

const isDocumentVisible = (): boolean => (
  typeof document === 'undefined' || document.visibilityState !== 'hidden'
);

export interface ParkingPanelProps {
  /** Override the photo snapshot in tests or when a live adapter is available. */
  ports?: readonly ParkingPort[];
  /** Optional return action supplied by the teaching-building host page. */
  onBack?: () => void;
  /**
   * Same-origin status endpoint. The response must explicitly set `live:true`
   * before the UI labels data as real-time; photo-demo fallbacks stay marked
   * as non-live.
   */
  statusEndpoint?: string;
  /** Enable status polling (15 seconds by default) when `statusEndpoint` exists. */
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

/** Match both the complete DeviceNumber and the short number printed on some
 * charger labels.  QR decoding is local; this helper never performs a
 * network request. */
export const matchParkingPort = (payload: string, ports: readonly ParkingPort[] = PARKING_PORTS): ParkingPort | null => {
  const text = payload.trim();
  if (!text) return null;
  let deviceNumber = '';
  try { deviceNumber = new URL(text).searchParams.get('DeviceNumber')?.trim() ?? ''; } catch { /* QR may be plain text */ }
  return ports.find((port) => [port.id, port.id.slice(0, -2), deviceNumber].some((candidate) => candidate && (text === candidate || text.includes(candidate)))) ?? null;
};

type ScanState = 'idle' | 'reading' | 'success' | 'error';

/**
 * Teaching-building parking/charging dashboard.
 *
 * The initial state is the QR-photo snapshot. Occupied cards count down in the
 * browser as a demonstration; the banner deliberately names this as non-live
 * until the status endpoint returns an explicit live payload.
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
  const [refreshInterval, setRefreshInterval] = useState<ParkingRefreshInterval>(() => (pollLive ? 15 : 0));
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>();
  const [refreshError, setRefreshError] = useState('');
  const [pageVisible, setPageVisible] = useState(isDocumentVisible);
  const [reservedId, setReservedId] = useState<string | null>(() => {
    try {
      const stored = window.localStorage.getItem(RESERVATION_KEY);
      return stored && ports.some((port) => port.id === stored) ? stored : null;
    } catch { return null; }
  });
  const [scanOpen, setScanOpen] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanMessage, setScanMessage] = useState('选择一张二维码图片，识别会在本机浏览器完成。');
  const [scanPayload, setScanPayload] = useState('');
  const [scanMatchId, setScanMatchId] = useState<string | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanRunRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const portsRef = useRef(ports);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    portsRef.current = ports;
    setPortState(clonePorts(ports));
  }, [ports]);

  useEffect(() => () => {
    mountedRef.current = false;
    refreshAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!pollLive) setRefreshInterval(0);
  }, [pollLive]);

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

  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!pollLive || !statusEndpoint || refreshAbortRef.current) return;

    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setRefreshing(true);
    setRefreshError('');

    try {
      const response = await fetch(`${statusEndpoint}${statusEndpoint.includes('?') ? '&' : '?'}t=${Date.now()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as ParkingStatusResponse;
      if (controller.signal.aborted || !mountedRef.current) return;

      const updates = Array.isArray(payload.data) ? payload.data : [];
      const updatesByDevice = new Map<string, ParkingStatusUpdate>();
      updates.forEach((item) => {
        const deviceNumber = String(item.deviceNumber ?? '').trim();
        if (deviceNumber && normalizeStatus(item.status)) updatesByDevice.set(deviceNumber, item);
      });
      const knownDevices = new Set(portsRef.current.map((port) => port.id));
      const applied = [...updatesByDevice.keys()].filter((deviceNumber) => knownDevices.has(deviceNumber)).length;

      setPortState((current) => current.map((port) => {
        const update = updatesByDevice.get(port.id);
        const nextStatus = normalizeStatus(update?.status);
        if (!update || !nextStatus) return port;
        const remaining = Number(update.remainingSeconds ?? 0);
        return {
          ...port,
          status: nextStatus,
          remainingSeconds: Number.isFinite(remaining) ? Math.max(0, Math.round(remaining)) : 0,
        };
      }));

      const sourceUpdatedAt = payload.updatedAt || new Date().toISOString();
      setUpdatedAt(sourceUpdatedAt);
      if (payload.live === true && applied > 0) {
        setLive(true);
        setStatusMessage(`实时同步 · ${formatUpdatedAt(sourceUpdatedAt)}`);
      } else {
        setLive(false);
        setStatusMessage(payload.message || '接口暂无实时数据，当前显示照片快照');
      }
    } catch (reason) {
      if (controller.signal.aborted || !mountedRef.current) return;
      const detail = reason instanceof Error && reason.message.startsWith('HTTP ')
        ? `（${reason.message}）`
        : '';
      const message = `实时接口不可用，当前显示照片快照 · 非实时${detail}`;
      setLive(false);
      setStatusMessage(message);
      setRefreshError(message);
    } finally {
      if (refreshAbortRef.current === controller) {
        refreshAbortRef.current = null;
        if (mountedRef.current) {
          setRefreshing(false);
          if (!controller.signal.aborted) setLastRefreshAt(new Date().toISOString());
        }
      }
    }
  }, [pollLive, statusEndpoint]);

  // Keep scheduled requests out of the background tab. Returning to the page
  // flips `pageVisible`, which triggers an immediate refresh before scheduling
  // the next interval.
  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(isDocumentVisible());
    const onOnline = () => {
      if (isDocumentVisible()) void refreshStatus();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [refreshStatus]);

  // A visible page syncs immediately on mount and when it returns from the
  // background. Changing the interval itself only reschedules the next tick;
  // selecting “暂停” therefore never causes a surprise network request.
  useEffect(() => {
    if (pollLive && statusEndpoint && pageVisible) void refreshStatus();
  }, [pageVisible, pollLive, refreshStatus, statusEndpoint]);

  useEffect(() => {
    if (!pollLive || !statusEndpoint || !pageVisible || refreshInterval === 0) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (!disposed && isDocumentVisible()) void refreshStatus();
    }, refreshInterval * 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [pageVisible, pollLive, refreshInterval, refreshStatus, statusEndpoint]);

  useEffect(() => {
    if (!pageVisible) refreshAbortRef.current?.abort();
  }, [pageVisible]);

  useEffect(() => () => {
    refreshAbortRef.current?.abort();
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

  useEffect(() => () => {
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
  }, [scanPreviewUrl]);

  const openScanner = () => {
    setScanOpen(true);
    setScanState('idle');
    setScanMessage('选择一张二维码图片，识别会在本机浏览器完成。');
    setScanPayload('');
    setScanMatchId(null);
  };

  const closeScanner = () => {
    scanRunRef.current += 1;
    setScanOpen(false);
    if (scanPreviewUrl) {
      URL.revokeObjectURL(scanPreviewUrl);
      setScanPreviewUrl(null);
    }
    setScanState('idle');
    setScanPayload('');
    setScanMatchId(null);
    if (scanInputRef.current) scanInputRef.current.value = '';
  };

  const handleScanFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScanState('error');
      setScanMessage('请选择 JPG、PNG、WEBP 等图片文件。');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setScanState('error');
      setScanMessage('图片超过 20 MB，请先压缩后重试。');
      return;
    }

    const run = scanRunRef.current + 1;
    scanRunRef.current = run;
    const objectUrl = URL.createObjectURL(file);
    if (scanPreviewUrl) URL.revokeObjectURL(scanPreviewUrl);
    setScanPreviewUrl(objectUrl);
    setScanState('reading');
    setScanMessage('正在本地识别二维码……图片不会上传。');
    setScanPayload('');
    setScanMatchId(null);

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      if (scanRunRef.current !== run) return;
      const text = typeof result?.getText === 'function' ? result.getText() : '';
      if (!text) throw new Error('EMPTY_RESULT');
      const match = matchParkingPort(text, ports);
      setScanPayload(text);
      setScanMatchId(match?.id ?? null);
      setScanState('success');
      setScanMessage(match
        ? `识别完成，已匹配 ${match.order} 号端口。`
        : '识别完成，但没有匹配当前 10 个端口。');
    } catch (reason) {
      if (scanRunRef.current !== run) return;
      const detail = reason instanceof Error ? reason.message : '';
      setScanState('error');
      setScanMessage(/not.?found|empty_result|no code|checksum/i.test(detail)
        ? '没有识别到二维码，请换一张更清晰、正面拍摄的图片。'
        : '二维码识别库加载失败或图片不可读，请重试。');
    }
  };

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

      <section className={`parking-signal ${live ? 'is-live' : ''}`} aria-live="polite" aria-busy={refreshing}>
        <span className="parking-signal-dot" aria-hidden="true" />
        <div>
          <strong>{live ? '实时状态' : '照片状态'}</strong>
          <span>{statusMessage}</span>
        </div>
        {updatedAt && <time dateTime={updatedAt}>更新于 {formatUpdatedAt(updatedAt)}</time>}
      </section>

      <section className="parking-refresh-controls" aria-label="状态刷新控制">
        <div className="parking-refresh-setting">
          <label htmlFor="parking-refresh-interval">自动刷新</label>
          <select
            id="parking-refresh-interval"
            aria-label="自动刷新间隔"
            value={refreshInterval}
            disabled={!pollLive || !statusEndpoint}
            onChange={(event) => setRefreshInterval(parseRefreshInterval(event.target.value))}
          >
            {PARKING_REFRESH_INTERVALS.map((interval) => (
              <option key={interval} value={interval}>{refreshIntervalLabel(interval)}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="parking-refresh-button"
          onClick={() => void refreshStatus()}
          disabled={!pollLive || !statusEndpoint || refreshing}
        >
          {refreshing ? '正在同步…' : '立即刷新'}
        </button>
        <div className="parking-refresh-meta" role="status" aria-live="polite">
          <span>
            {!pageVisible
              ? '页面在后台，已暂停自动刷新'
              : refreshInterval === 0
                ? '自动刷新已暂停，可手动同步'
                : `${refreshIntervalLabel(refreshInterval)} · 页面可见时运行`}
          </span>
          {lastRefreshAt && <time dateTime={lastRefreshAt}>上次刷新 {formatUpdatedAt(lastRefreshAt)}</time>}
          {refreshError && <span className="parking-refresh-error" role="alert">{refreshError}</span>}
        </div>
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
        <div className="parking-toolbar-actions">
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
          <button type="button" className="parking-scan-trigger" onClick={openScanner}>
            <span aria-hidden="true">⌁</span> 本地扫码识别
          </button>
        </div>
      </section>

      {scanOpen && (
        <section className="parking-scanner" aria-labelledby="parking-scanner-title">
          <header className="parking-scanner-header">
            <div>
              <span className="parking-scanner-kicker">LOCAL CHECK · QR</span>
              <h2 id="parking-scanner-title">识别二维码</h2>
            </div>
            <button type="button" className="parking-scanner-close" onClick={closeScanner}>关闭</button>
          </header>
          <p className="parking-scanner-intro">选择或拍摄一张二维码图片，ZXing 会在当前浏览器本地解码；图片不会上传到服务器。</p>
          <div className="parking-scanner-actions">
            <label className="parking-scan-file-button">
              <span aria-hidden="true">＋</span> 选择图片 / 拍照
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void handleScanFile(event.target.files?.[0])}
              />
            </label>
            <span className={`parking-scan-state parking-scan-state-${scanState}`} role="status" aria-live="polite">{scanMessage}</span>
          </div>
          {scanPreviewUrl && (
            <div className="parking-scan-preview">
              <img src={scanPreviewUrl} alt="待识别的二维码图片" />
              {scanState === 'reading' && <span className="parking-scan-loading">识别中…</span>}
            </div>
          )}
          {scanState === 'success' && scanPayload && (
            <div className="parking-scan-result">
              <span className="parking-scan-result-label">识别内容</span>
              <code>{scanPayload}</code>
              {scanMatchId ? (
                <button type="button" onClick={() => { const match = portState.find((port) => port.id === scanMatchId); if (match) { setScanOpen(false); openDetails(match); } }}>
                  打开匹配端口详情
                </button>
              ) : <span className="parking-scan-unmatched">未匹配当前 10 个端口，可在搜索框中手动查找。</span>}
            </div>
          )}
          <p className="parking-scanner-note">识别只读取二维码文字；它不会读取支付宝密码、Cookie、验证码或设备实时状态。</p>
        </section>
      )}

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
