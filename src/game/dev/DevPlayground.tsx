/**
 * 开发测试场景页面（仅开发模式，地址 /?scene=dev-playground）。
 *
 * 临时：在 v20 地图标定完成前，走通完整链路——
 * 进入临时互动范围 → 显示“按 E 进入【地点名称】” → 按 E → 宿主打开地点功能页（暂停移动、清键）
 * → 返回校园 → 恢复按 E 时的原位置与朝向（原位失效时用兜底点）。
 *
 * 生产构建不包含入口（见 main.tsx 中的 import.meta.env.DEV 判断）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import { MAP_ID, type PlaceId } from '@/shared/contracts';
import { getPlace } from '@/shared/place-registry';
import PlaceHost, { type PlaceHostHandle } from '@/app/PlaceHost';
import type { OpenContext } from '@/app/place-session';
import { DevPlaygroundScene, type PlaygroundSnapshot } from './DevPlaygroundScene';
import { DEV_TUNING, type WalkableWorld } from '../movement/movement';
import { resolveReturnPosition, selectTarget, activeInteractions } from '../interaction/interaction';
import {
  PLAYGROUND_COLLISION,
  PLAYGROUND_INTERACTIONS,
  PLAYGROUND_SAFE_POINTS,
  PLAYGROUND_TELEPORTS,
  PLAYGROUND_WALKABLE,
} from './playground-world';

const WORLD: WalkableWorld = { walkableAreas: PLAYGROUND_WALKABLE, collisionAreas: PLAYGROUND_COLLISION };

const TELEPORT_LABELS: Record<keyof typeof PLAYGROUND_TELEPORTS, string> = {
  xiaoxiang_library: '图书馆范围',
  xiaoxiang_teaching_group: '教学楼群范围',
  xiaoxiang_sports_ground: '副场范围',
  overlap: '重叠区',
  outside: '范围外',
};

export default function DevPlayground() {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<DevPlaygroundScene | null>(null);
  const hostHandle = useRef<PlaceHostHandle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<PlaygroundSnapshot | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState<string | null>(null);

  useEffect(() => {
    if (!host.current) return;
    let mounted = true;
    const playground = new DevPlaygroundScene({
      onReady: () => mounted && setStatus('ready'),
      onError: (message) => {
        if (!mounted) return;
        setError(message);
        setStatus('error');
      },
      onSnapshot: (value) => mounted && setSnapshot(value),
      onRequestOpenPlace: ({ placeId, position, facing }) => {
        // 对应 request-open-place { placeId }；宿主再次校验地点与功能页状态。
        // 测试场景复用契约的会话结构：mapId 字段按契约只能取当前运行地图 ID，
        // 这里的坐标属于合成测试世界，不代表 v20 地图上的位置。
        hostHandle.current?.requestOpen({ placeId, entryPosition: position, facing, mapId: MAP_ID });
      },
    });
    scene.current = playground;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: '#2c3f33',
      pixelArt: true,
      banner: false,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: [playground],
    });
    game.canvas.setAttribute('aria-label', '开发测试场景画布，使用 WASD 移动，按住 Shift 骑行，在范围内按 E 进入地点');
    game.canvas.setAttribute('role', 'img');
    // 画布可获得焦点：点击画布后，输入框失去焦点，WASD 重新驱动角色。
    game.canvas.tabIndex = 0;
    game.canvas.addEventListener('pointerdown', () => game.canvas.focus());
    return () => {
      mounted = false;
      scene.current = null;
      game.destroy(true);
    };
  }, []);

  // 手动“模拟功能页打开”与真实功能页任一生效时都暂停。
  useEffect(() => {
    scene.current?.setSuspended(suspended || placeOpen || returnError !== null);
  }, [suspended, placeOpen, returnError]);

  const registerHandle = useCallback((handle: PlaceHostHandle | null) => {
    hostHandle.current = handle;
  }, []);
  const validateOpen = useCallback((context: OpenContext) => {
    const state = scene.current?.currentState;
    return !!state && !scene.current?.keys.isSuspended() &&
      selectTarget(state.position, activeInteractions(PLAYGROUND_INTERACTIONS)) === context.placeId &&
      state.position.x === context.entryPosition.x && state.position.y === context.entryPosition.y;
  }, []);

  const onSuspendMap = useCallback(() => {
    scene.current?.setSuspended(true);
    setReturnNote(null);
  }, []);

  const onResumeMap = useCallback((context: OpenContext) => {
    const resolution = resolveReturnPosition(
      context,
      PLAYGROUND_INTERACTIONS,
      PLAYGROUND_SAFE_POINTS,
      WORLD,
      DEV_TUNING.walkFootprint,
    );
    if (resolution.kind === 'error') {
      // 没有有效落点：明确报错并保持暂停，不送到 (0,0) 或任意地标。
      setReturnError(resolution.message);
      return;
    }
    scene.current?.restore(resolution.position, context.facing);
    setReturnError(null);
    setReturnNote(resolution.kind === 'fallback' ? `原位置已失效，已回到兜底点 ${resolution.safePointId}` : null);
    requestAnimationFrame(() => host.current?.querySelector('canvas')?.focus());
  }, []);

  const teleport = (key: keyof typeof PLAYGROUND_TELEPORTS) => {
    scene.current?.devTeleport(PLAYGROUND_TELEPORTS[key]);
    host.current?.querySelector('canvas')?.focus();
  };

  const targetName = snapshot?.target ? getPlace(snapshot.target as PlaceId)?.name : null;

  return (
    <main className="campus-app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">DEV PLAYGROUND</p><h1>角色移动测试场景</h1></div>
        <span className="preview-label">{placeOpen ? '地点功能页' : '开发模式'}</span>
      </header>
      <PlaceHost
        onSuspendMap={onSuspendMap}
        onResumeMap={onResumeMap}
        registerHandle={registerHandle}
        onOpenChange={setPlaceOpen}
        validateOpen={validateOpen}
      >
        <div hidden={placeOpen}>
          <p className="dev-banner" role="note">
            <strong>测试场景 · 临时标注与临时角色，非正式验收。</strong>
            地形与三个互动范围为合成测试数据，与 v20 校园地图无坐标对应；角色为队友原型占位造型，骑行外观暂以奔跑动画顶替。
            速度、碰撞体尺寸均为开发调试值，移动耗时与骑行倍率仍待确认。
          </p>
          {returnError && <p className="place-error" role="alert">{returnError}</p>}
          {returnNote && <p className="place-hint" role="status">{returnNote}</p>}
          <div className="playground-layout">
            <section className="map-panel" aria-label="测试场景">
              <div className="map-stage playground-stage">
                <div ref={host} className="map-canvas" />
                {status === 'loading' && <div className="map-message">正在加载测试场景…</div>}
                {status === 'error' && (
                  <div className="map-message" role="alert"><strong>测试场景加载失败</strong><p>{error}</p></div>
                )}
              </div>
              <div className="map-footer">
                <span>WASD 移动 · 按住 Shift 骑行 · 在彩色范围内按 E 进入 · 红框为脚底碰撞体</span>
                <span>测试世界 480 × 320</span>
              </div>
            </section>
            <aside className="playground-hud" aria-label="角色状态">
              <dl>
                <div><dt>场景状态</dt><dd role="status" aria-label="测试场景状态">{status === 'ready' ? '测试场景已就绪' : status === 'loading' ? '加载中' : '加载失败'}</dd></div>
                <div><dt>脚底位置</dt><dd data-testid="hud-position">{snapshot ? `${snapshot.x}, ${snapshot.y}` : '—'}</dd></div>
                <div><dt>朝向</dt><dd data-testid="hud-facing">{snapshot?.facing ?? '—'}</dd></div>
                <div><dt>模式</dt><dd data-testid="hud-mode">{snapshot?.mode ?? '—'}</dd></div>
                <div><dt>动作</dt><dd data-testid="hud-action">{snapshot ? (snapshot.moving ? 'move' : 'idle') : '—'}</dd></div>
                <div><dt>遮挡</dt><dd data-testid="hud-occlusion">{snapshot ? (snapshot.characterDepth > snapshot.occluderDepth ? '角色在树前' : '角色在树后') : '—'}</dd></div>
                <div><dt>输入</dt><dd data-testid="hud-suspended">{snapshot?.suspended ? '已暂停' : '可移动'}</dd></div>
                <div><dt>互动目标</dt><dd data-testid="hud-target">{targetName ?? '无'}</dd></div>
              </dl>
              {targetName && <p className="interact-prompt" data-testid="interact-prompt">按 E 进入【{targetName}】</p>}
              <div className="playground-teleports" aria-label="开发瞬移">
                <span>开发瞬移（仅测试场景）：</span>
                {(Object.keys(PLAYGROUND_TELEPORTS) as (keyof typeof PLAYGROUND_TELEPORTS)[]).map((key) => (
                  <button key={key} onClick={() => teleport(key)}>{TELEPORT_LABELS[key]}</button>
                ))}
              </div>
              <p className="playground-tuning">
                调试参数：步行 {DEV_TUNING.walkSpeed} px/s、骑行 {DEV_TUNING.rideSpeed} px/s；
                脚底碰撞体 {DEV_TUNING.walkFootprint.width}×{DEV_TUNING.walkFootprint.height} / {DEV_TUNING.rideFootprint.width}×{DEV_TUNING.rideFootprint.height}
              </p>
              <label className="place-field">
                <span>输入框测试：在此输入 WASD 或 E 不应移动角色或打开页面</span>
                <input placeholder="在这里打字" />
              </label>
              <label className="playground-toggle">
                <input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} />
                模拟功能页打开（暂停移动并清键）
              </label>
              <a className="original-link" href="/">返回地图预览</a>
            </aside>
          </div>
        </div>
      </PlaceHost>
    </main>
  );
}
