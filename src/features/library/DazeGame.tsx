import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './DazeGame.css';

type Point = { x: number; y: number };
type Ending = 'escaped' | 'caught' | 'timeout' | null;

const START: Point = { x: 10, y: 78 };
const DEVICES: Point[] = [
  { x: 28, y: 23 },
  { x: 54, y: 73 },
  { x: 77, y: 30 },
];
const HIDING_SPOTS: Point[] = [
  { x: 19, y: 50 },
  { x: 63, y: 18 },
  { x: 88, y: 66 },
];
const GATE: Point = { x: 94, y: 78 };
const ROUTE_KEY = 'campus-lockdown-last-route';

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function readLastRoute(): Point[] {
  try {
    const value = JSON.parse(localStorage.getItem(ROUTE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number') : [];
  } catch {
    return [];
  }
}

function readSharedRoute(): Point[] {
  const raw = window.location.hash.startsWith('#route=') ? window.location.hash.slice(7) : '';
  if (!raw) return [];
  try {
    const value = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(value) ? value.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number') : [];
  } catch {
    return [];
  }
}

export default function DazeGame() {
  const [started, setStarted] = useState(false);
  const [seconds, setSeconds] = useState(300);
  const [player, setPlayer] = useState<Point>(START);
  const [enemy, setEnemy] = useState<Point>({ x: 7, y: 7 });
  const [activated, setActivated] = useState<boolean[]>([false, false, false]);
  const [hasKey, setHasKey] = useState(false);
  const [hasBattery, setHasBattery] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ending, setEnding] = useState<Ending>(null);
  const [noise, setNoise] = useState<Point | null>(null);
  const [route, setRoute] = useState<Point[]>([START]);
  const [lastRoute, setLastRoute] = useState<Point[]>([]);
  const [notice, setNotice] = useState('先启动三个应急装置，再去校门。');
  const noiseTimer = useRef<number | undefined>(undefined);

  const stage = activated.filter(Boolean).length;
  const finalThirty = seconds <= 30 && started && !ending;
  const nearestDevice = useMemo(() => {
    let best = -1;
    let bestDistance = Infinity;
    DEVICES.forEach((point, index) => {
      if (!activated[index] && distance(player, point) < bestDistance) {
        best = index;
        bestDistance = distance(player, point);
      }
    });
    return bestDistance < 9 ? best : -1;
  }, [activated, player]);

  const finish = useCallback((result: Ending, message: string) => {
    setEnding(result);
    setStarted(false);
    setNotice(message);
    try { localStorage.setItem(ROUTE_KEY, JSON.stringify(route)); } catch { /* private mode */ }
  }, [route]);

  const makeNoise = useCallback((point: Point, loud = true) => {
    if (!loud) return;
    setNoise(point);
    window.clearTimeout(noiseTimer.current);
    noiseTimer.current = window.setTimeout(() => setNoise(null), 1100);
  }, []);

  const move = useCallback((dx: number, dy: number) => {
    if (!started || ending || hidden) return;
    setPlayer((current) => {
      const next = { x: clamp(current.x + dx, 5, 95), y: clamp(current.y + dy, 7, 91) };
      setRoute((points) => [...points.slice(-44), next]);
      makeNoise(next, Math.abs(dx) + Math.abs(dy) > 0.1);
      return next;
    });
  }, [ending, hidden, makeNoise, started]);

  useEffect(() => {
    const sharedRoute = readSharedRoute();
    setLastRoute(sharedRoute.length > 1 ? sharedRoute : readLastRoute());
  }, []);

  useEffect(() => {
    if (!started || ending) return;
    const timer = window.setInterval(() => {
      if (seconds <= 1) {
        setSeconds(0);
        finish('timeout', '时间耗尽。警报锁死了校园，下一次要更快。');
        return;
      }
      setSeconds((value) => Math.max(0, value - 1));
      setEnemy((current) => {
        // The broadcast shadow only wakes after the third device is active.
        if (hidden || stage < 2) return current;
        const target = noise ?? player;
        const speed = 0.65 + stage * 0.17 + (seconds <= 30 ? 0.45 : 0);
        const gap = distance(current, target) || 1;
        const next = { x: current.x + ((target.x - current.x) / gap) * speed, y: current.y + ((target.y - current.y) / gap) * speed };
        if (distance(next, player) < (seconds <= 30 ? 5 : 4)) finish('caught', '广播影子循着声音找到了你。');
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ending, finish, hidden, noise, player, seconds, stage, started]);

  useEffect(() => {
    if (!started || ending) return;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'w'].includes(key)) { event.preventDefault(); move(0, -4); }
      if (['arrowdown', 's'].includes(key)) { event.preventDefault(); move(0, 4); }
      if (['arrowleft', 'a'].includes(key)) { event.preventDefault(); move(-4, 0); }
      if (['arrowright', 'd'].includes(key)) { event.preventDefault(); move(4, 0); }
      if (key === 'e') interact();
      if (key === 'h') setHidden((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function interact() {
    if (!started || ending) return;
    const deviceIndex = nearestDevice;
    if (deviceIndex >= 0) {
      setActivated((values) => values.map((value, index) => index === deviceIndex ? true : value));
      setNotice(`应急装置 ${deviceIndex + 1} 已启动。${deviceIndex === 0 ? '广播开始报错，部分门锁死。' : deviceIndex === 1 ? '灯光熄灭，路线正在改变。' : '广播影子已被唤醒。'}`);
      makeNoise(player, true);
      return;
    }
    if (!hasKey && distance(player, { x: 42, y: 44 }) < 8) { setHasKey(true); setNotice('你找到了一把旧钥匙，东侧捷径可以打开。'); return; }
    if (!hasBattery && distance(player, { x: 72, y: 82 }) < 8) { setHasBattery(true); setNotice('电池入手。停电后的储物门可以开启。'); return; }
    if (distance(player, GATE) < 9) {
      if (stage === 3 && (hasKey || hasBattery || finalThirty)) finish('escaped', '校门只开了一次——你冲出去了！');
      else setNotice('校门还锁着：先启动 3 个装置。');
      return;
    }
    setNotice('这里没有可以操作的东西。');
  }

  function toggleHide() {
    if (!started || ending) return;
    const near = HIDING_SPOTS.some((spot) => distance(player, spot) < 8);
    if (near) { setHidden((value) => !value); setNotice(hidden ? '你离开了藏身处。脚步声又回来了。' : '你屏住呼吸，藏进了阴影。'); }
    else setNotice('找一间教室、储物柜或厕所再按 H。');
  }

  function start() {
    setStarted(true); setEnding(null); setSeconds(300); setPlayer(START); setEnemy({ x: 7, y: 7 });
    setActivated([false, false, false]); setHasKey(false); setHasBattery(false); setHidden(false); setRoute([START]); setNotice('封锁开始。跑，但别让声音出卖你。');
  }

  async function shareRoute() {
    const url = new URL(window.location.href);
    url.hash = `route=${encodeURIComponent(JSON.stringify(route))}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setNotice('逃生路线已复制，发给朋友来挑战。');
    } catch {
      setNotice(`路线链接：${url.toString()}`);
    }
  }

  return (
    <section className={`daze-game stage-${stage}${finalThirty ? ' final-countdown' : ''}`} aria-label="封校倒计时小游戏">
      <header className="daze-head">
        <div><span className="daze-kicker">发呆 · NIGHT SHIFT 01</span><h2>封校倒计时</h2><p>找到 3 个应急装置，再抵达校门。</p></div>
        <div className="daze-clock" aria-label={`剩余 ${formatTime(seconds)}`}>{formatTime(seconds)}</div>
      </header>

      {!started && !ending && (
        <div className="daze-start"><span className="daze-siren">!</span><h3>校园已进入紧急封锁</h3><p>WASD / 方向键移动 · E 操作 · H 躲藏</p><button type="button" onClick={start}>开始逃生</button></div>
      )}

      {(started || ending) && <>
        <div className="daze-status"><span className="daze-phase">阶段 {Math.min(stage + 1, 3)} · {stage === 0 ? '广播故障' : stage === 1 ? '灯光熄灭' : '影子追踪'}</span><span>{activated.filter(Boolean).length}/3 装置</span><span className={hidden ? 'is-hidden' : ''}>{hidden ? '藏身中' : '暴露'}</span>{lastRoute.length > 1 && <span className="daze-ghost-label">浅蓝虚线：上一位玩家</span>}</div>
        <div className="daze-board" role="application" aria-label="教学楼与操场逃生地图">
          <div className="daze-building building-a"><span>教学楼 A</span></div><div className="daze-building building-b"><span>教学楼 B</span></div><div className="daze-field"><span>操场</span></div>
          {HIDING_SPOTS.map((spot, i) => <div key={`hide-${i}`} className="daze-hide" style={{ left: `${spot.x}%`, top: `${spot.y}%` }} title="藏身点">▣</div>)}
          {DEVICES.map((spot, i) => <div key={`device-${i}`} className={`daze-device ${activated[i] ? 'active' : ''}`} style={{ left: `${spot.x}%`, top: `${spot.y}%` }}><b>{activated[i] ? '✓' : i + 1}</b><small>应急装置</small></div>)}
          <div className="daze-item key-item" style={{ left: '42%', top: '44%' }}>钥匙</div><div className="daze-item battery-item" style={{ left: '72%', top: '82%' }}>电池</div>
          <div className="daze-gate" style={{ left: `${GATE.x}%`, top: `${GATE.y}%` }}>校门</div>
          {lastRoute.length > 1 && <svg className="daze-ghost-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="上一位玩家的残影路线"><polyline points={lastRoute.map((p) => `${p.x},${p.y}`).join(' ')} /></svg>}
          {noise && <div className="daze-noise" style={{ left: `${noise.x}%`, top: `${noise.y}%` }} />}
          <div className={`daze-enemy ${stage < 2 ? 'sleeping' : ''}`} style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }} aria-label="广播影子">◉</div>
          <div className={`daze-player ${hidden ? 'hidden' : ''}`} style={{ left: `${player.x}%`, top: `${player.y}%` }} aria-label="玩家">▲</div>
          {ending && <div className={`daze-ending ending-${ending}`}><strong>{ending === 'escaped' ? '逃出生天' : ending === 'caught' ? '被广播影子抓住' : '时间耗尽'}</strong><p>{notice}</p><button type="button" onClick={start}>再来一局</button>{route.length > 2 && <button type="button" onClick={shareRoute}>分享逃生路线</button>}</div>}
        </div>
        <div className="daze-controls"><button type="button" onClick={() => move(0, -4)}>↑</button><button type="button" onClick={() => move(-4, 0)}>←</button><button type="button" onClick={() => move(0, 4)}>↓</button><button type="button" onClick={() => move(4, 0)}>→</button><button type="button" className="daze-action" onClick={interact}>E 操作</button><button type="button" className="daze-action" onClick={toggleHide}>H 躲藏</button></div>
        <p className="daze-notice" role="status">{notice}</p>
      </>}
    </section>
  );
}
