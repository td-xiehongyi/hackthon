import { useEffect, useRef, useState } from 'react';
import type { CharacterManifest, SpriteFrame } from '@/shared/contracts';
import { readCharacterChoice, type CharacterChoice } from '@/game/character/choices';
import { ClipPlayer } from '@/game/character/clip-player';
import { validateManifest } from '@/game/character/manifest';
import { createRun, resumeRun, RUN_CHECKPOINTS, stepRun, GUARD_FADE_MS, type RunState } from './campus-run';
import './campus-run.css';

const BACKGROUND = '/scenes/campus-running-track-v1.png';
const GUARD = '/scenes/campus-run-guard-transparent-v2.png';
const CONTROLS = [
  { label: '向左跑', key: 'a', text: '←' }, { label: '向上跑', key: 'w', text: '↑' },
  { label: '向下跑', key: 's', text: '↓' }, { label: '向右跑', key: 'd', text: '→' },
];

export default function CampusRun({ characterChoice }: { characterChoice?: CharacterChoice }) {
  const [fallback] = useState(readCharacterChoice);
  const character = characterChoice ?? fallback;
  const [run, setRun] = useState(createRun);
  const state = useRef(run);
  const keys = useRef(new Set<string>());
  const board = useRef<SVGSVGElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const rideSources = useRef(new Set<string>());
  const rideStartedAt = useRef<number | null>(null);
  const [assets, setAssets] = useState<{ manifest: CharacterManifest; player: ClipPlayer } | null>(null);
  const [frame, setFrame] = useState<SpriteFrame | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  function update(next: RunState) { state.current = next; setRun(next); }
  function clearInput() {
    keys.current.clear();
    rideSources.current.clear();
    rideStartedAt.current = null;
  }
  function beginRide(source: string) {
    if (state.current.status !== 'running') return;
    if (rideSources.current.size === 0) rideStartedAt.current = performance.now();
    rideSources.current.add(source);
  }
  function endRide(source: string) {
    rideSources.current.delete(source);
    if (rideSources.current.size === 0) rideStartedAt.current = null;
  }
  function start() {
    clearInput();
    update({ ...createRun(), status: 'running' });
    board.current?.focus();
  }
  function continueRunning() {
    clearInput();
    update(resumeRun(state.current));
    board.current?.focus();
  }

  useEffect(() => {
    let cancelled = false;
    setAssets(null); setError('');
    async function load() {
      try {
        const response = await fetch(`${character.dir}/manifest.json`);
        if (!response.ok) throw new Error('manifest');
        const manifest: CharacterManifest = await response.json();
        if (validateManifest(manifest).length) throw new Error('manifest');
        await Promise.all([BACKGROUND, GUARD, ...manifest.sheets.map(sheet => `${character.dir}/${sheet.url}`)].map(async url => {
          const image = new Image(); image.src = url; await image.decode();
        }));
        if (!cancelled) {
          const player = new ClipPlayer(manifest);
          setFrame(player.update({ mode: 'walk', facing: 'right', action: 'idle' }, 0));
          setAssets({ manifest, player });
        }
      } catch {
        if (!cancelled) setError('操场或角色图片加载失败，请重试。');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [character.dir, retry]);

  useEffect(() => {
    if (!assets) return;
    let raf = 0;
    let last = performance.now();
    const clear = clearInput;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.current.status === 'warning') {
        event.preventDefault(); continueRunning(); return;
      }
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (state.current.status !== 'running') return;
      const key = event.key.toLowerCase();
      if (key === 'shift') {
        event.preventDefault();
        if (!event.repeat) beginRide(event.code);
        return;
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        event.preventDefault(); keys.current.add(key);
      }
    };
    const keyup = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
      if (event.key === 'Shift') endRide(event.code);
    };
    const tick = (now: number) => {
      const dt = now - last; last = now;
      const pressed = keys.current;
      const next = stepRun(state.current, {
        x: Number(pressed.has('d') || pressed.has('arrowright')) - Number(pressed.has('a') || pressed.has('arrowleft')),
        y: Number(pressed.has('s') || pressed.has('arrowdown')) - Number(pressed.has('w') || pressed.has('arrowup')),
        ride: rideStartedAt.current !== null,
        rideHeldMs: rideStartedAt.current === null ? 0 : now - rideStartedAt.current,
      }, dt);
      if (next.status === 'guard-entering' && state.current.status === 'running') clear();
      if (next !== state.current) update(next);
      setFrame(assets.player.update({ mode: next.riding ? 'ride' : 'walk', facing: next.facing, action: next.moving ? 'move' : 'idle' }, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      cancelAnimationFrame(raf); clear();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [assets]);

  useEffect(() => {
    if (run.status === 'warning') bubble.current?.focus({ preventScroll: true });
  }, [run.status]);

  const sheet = assets?.manifest.sheets.find(sheet => sheet.id === frame?.sheetId);
  const scale = frame ? 46 / frame.rect.height : 1;
  const notice = run.status === 'success' ? '校园跑成功！你已完成一圈。'
    : run.status === 'ready' ? '从起点向右出发，逆时针依次打卡。'
      : run.status === 'warning' ? '操场禁止骑电动车！！！'
        : run.status === 'guard-entering' ? '有人来提醒你了…'
        : run.next === 7 ? '最后一步：回到起点，完成一圈！' : `前往 ${run.next + 1} 号打卡点`;

  return <section className="campus-run" aria-label="校园跑小游戏" data-status={run.status} data-character={character.id}>
    <header className="campus-run-heading">
      <div><span className="campus-run-kicker">操场 · 一圈挑战</span><h2>校园跑</h2></div>
      <strong className="campus-run-count" aria-label={`已打卡 ${run.next} / 8`}>{run.next}<small> / 8 打卡</small></strong>
    </header>
    {run.status === 'ready' && <button className="campus-run-start" disabled={!assets} onClick={start}>
      {assets ? '开始校园跑' : error ? '等待素材加载' : '正在加载场景…'}
    </button>}
    <p className="campus-run-instructions">WASD / 方向键移动，逆时针打卡一圈。连续按住 Shift 0.75 秒会被提醒禁止骑行。</p>
    <div className="campus-run-progress" role="progressbar" aria-label="本圈打卡进度" aria-valuemin={0} aria-valuemax={8} aria-valuenow={run.next}>
      <span style={{ width: `${run.next / 8 * 100}%` }} />
    </div>
    {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>重试加载</button></p>}
    <div className="campus-run-stage">
    <svg ref={board} className="campus-run-board" viewBox="0 0 1000 562.8" role="img" aria-label="校园跑操场，逆时针沿编号打卡点跑一圈" tabIndex={0}
      onBlur={clearInput} onPointerDown={() => board.current?.focus()}>
      <image href={BACKGROUND} width="1000" height="562.8" />
      <path className="campus-run-route" d="M500 420 H280 A170 150 0 0 1 280 120 H720 A170 150 0 0 1 720 420 Z" />
      <g className="campus-run-arrows" aria-hidden="true"><text x="610" y="425">→</text><text x="106" y="204">↓</text><text x="400" y="128">←</text><text x="886" y="350">↑</text></g>
      {RUN_CHECKPOINTS.map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y})`}
        className={`campus-run-checkpoint ${index < run.next ? 'done' : index === run.next ? 'next' : ''}`}>
        {index === run.next && <circle r="26" className="campus-run-halo" />}
        <circle r="17" /><text y="6">{index < run.next ? '✓' : index === 7 ? '终' : index + 1}</text>
      </g>)}
      <g className="campus-run-field-note" aria-hidden="true"><text x="500" y="245">{run.status === 'success' ? '一圈完成！' : '校园跑'}</text>
        <text x="500" y="278" className="campus-run-field-small">{run.status === 'success' ? '每一步都算数' : '逆时针前进 · 操场禁止骑行'}</text></g>
      {frame && sheet && <g data-testid="campus-run-player" data-mode={run.riding ? 'ride' : 'walk'} data-x={run.position.x.toFixed(2)} data-y={run.position.y.toFixed(2)} aria-label={character.name}>
        <ellipse cx={run.position.x} cy={run.position.y} rx="13" ry="5" fill="#1c392a66" />
        <svg x={run.position.x - frame.anchor.x * scale} y={run.position.y - frame.anchor.y * scale}
          width={frame.rect.width * scale} height={frame.rect.height * scale}
          viewBox={`${frame.rect.x} ${frame.rect.y} ${frame.rect.width} ${frame.rect.height}`} overflow="hidden"
          style={{ filter: character.hue ? `hue-rotate(${character.hue}deg)` : undefined }}>
          <image href={`${character.dir}/${sheet.url}`} width={sheet.width} height={sheet.height} />
        </svg>
      </g>}
    </svg>
    {(run.status === 'guard-entering' || run.status === 'warning') && <div className="campus-run-guard-scene">
      <img className="campus-run-guard" src={GUARD} alt="抱臂提醒禁止骑电动车的角色"
        style={{ opacity: run.guardElapsedMs / GUARD_FADE_MS }} />
      {run.status === 'warning' && <div ref={bubble} className="campus-run-warning-bubble" role="dialog" aria-modal="false" aria-labelledby="campus-run-warning-title" tabIndex={-1}>
        <h3 id="campus-run-warning-title">操场禁止骑电动车！！！</h3><p>下车步行，已有打卡进度会保留。</p>
      </div>}
    </div>}
    </div>
    <p className={`campus-run-notice ${run.status === 'success' ? 'success' : ''}`} role="status">{notice}</p>
    <div className="campus-run-actions">
      {run.status === 'success' && <button className="campus-run-start" onClick={start}>再跑一圈</button>}
      {run.status === 'running' && <button onClick={start}>重新开始</button>}
      <div className="campus-run-controls" role="group" aria-label="校园跑方向控制">
        {CONTROLS.map(control => <button key={control.key} aria-label={control.label} disabled={run.status !== 'running'}
          onPointerDown={event => {
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            if (state.current.status === 'running') keys.current.add(control.key);
          }}
          onPointerUp={() => keys.current.delete(control.key)} onPointerCancel={() => keys.current.delete(control.key)}
          onLostPointerCapture={() => keys.current.delete(control.key)}
          onClick={event => { if (event.detail === 0) update(stepRun(state.current, { x: control.key === 'a' ? -1 : control.key === 'd' ? 1 : 0, y: control.key === 'w' ? -1 : control.key === 's' ? 1 : 0, ride: false }, 50)); }}>
          {control.text}
        </button>)}
      </div>
      <button disabled={run.status !== 'running'} className="campus-run-ride" title="持续按住 0.75 秒触发骑行提醒"
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginRide('pointer'); }}
        onPointerUp={() => endRide('pointer')} onPointerCancel={() => endRide('pointer')} onLostPointerCapture={() => endRide('pointer')}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) beginRide('button-key'); } }}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') endRide('button-key'); }}
        onBlur={() => { endRide('pointer'); endRide('button-key'); }}>按住骑电动车 · Shift</button>
      {run.status === 'warning' && <button className="campus-run-start" onClick={continueRunning}>知道了，继续跑步</button>}
    </div>
  </section>;
}
