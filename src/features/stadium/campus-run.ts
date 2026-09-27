import type { Direction, Point } from '@/shared/contracts';

export interface RunState {
  position: Point;
  facing: Direction;
  moving: boolean;
  riding: boolean;
  guardElapsedMs: number;
  next: number;
  status: 'ready' | 'running' | 'guard-entering' | 'warning' | 'success';
}
export interface RunInput { x: number; y: number; ride: boolean; rideHeldMs?: number }
export const RIDE_WARNING_MS = 750;
export const GUARD_FADE_MS = 350;

export const RUN_CHECKPOINTS: readonly Point[] = [
  { x: 720, y: 420 }, { x: 890, y: 270 }, { x: 720, y: 120 }, { x: 500, y: 120 },
  { x: 280, y: 120 }, { x: 110, y: 270 }, { x: 280, y: 420 }, { x: 500, y: 420 },
];

export function createRun(): RunState {
  return { position: { x: 500, y: 420 }, facing: 'right', moving: false, riding: false, guardElapsedMs: 0, next: 0, status: 'ready' };
}

/** Coordinates use a 1000 × 562.8 view of campus-running-track-v1.png. */
export function isOnTrack(point: Point): boolean {
  const dx = Math.max(280 - point.x, 0, point.x - 720) / 170;
  const dy = (point.y - 270) / 150;
  const radius = Math.hypot(dx, dy);
  return radius >= 0.84 && radius <= 1.14;
}

export function resumeRun(state: RunState): RunState {
  return state.status === 'warning' ? { ...state, status: 'running', moving: false, riding: false, guardElapsedMs: 0 } : state;
}

export function stepRun(state: RunState, input: RunInput, deltaMs: number): RunState {
  if (state.status === 'guard-entering') {
    const guardElapsedMs = Math.min(GUARD_FADE_MS, state.guardElapsedMs + Math.max(0, deltaMs));
    return { ...state, guardElapsedMs, status: guardElapsedMs >= GUARD_FADE_MS ? 'warning' : 'guard-entering' };
  }
  if (state.status !== 'running') return state;
  if (input.ride && (input.rideHeldMs ?? 0) >= RIDE_WARNING_MS) {
    return { ...state, status: 'guard-entering', moving: false, riding: false, guardElapsedMs: 0 };
  }
  const magnitude = Math.hypot(input.x, input.y);
  const distance = (input.ride ? 300 : 150) * Math.max(0, Math.min(deltaMs, 50)) / 1000;
  const dx = magnitude ? input.x / magnitude * distance : 0;
  const dy = magnitude ? input.y / magnitude * distance : 0;
  let position = state.position;
  const steps = Math.max(1, Math.ceil(distance / 2));
  for (let i = 0; i < steps; i++) {
    const candidate = { x: position.x + dx / steps, y: position.y + dy / steps };
    if (isOnTrack(candidate)) position = candidate;
    else {
      // Slide along the boundary without ever crossing the grass.
      const horizontal = { x: candidate.x, y: position.y };
      if (isOnTrack(horizontal)) position = horizontal;
      const vertical = { x: position.x, y: candidate.y };
      if (isOnTrack(vertical)) position = vertical;
    }
  }
  let next = state.next;
  const target = RUN_CHECKPOINTS[next];
  if (!input.ride && target && Math.hypot(position.x - target.x, position.y - target.y) <= 23) next++;
  const facing = magnitude === 0 ? state.facing : Math.abs(input.x) > Math.abs(input.y)
    ? input.x < 0 ? 'left' : 'right' : input.y < 0 ? 'up' : 'down';
  const status = next === RUN_CHECKPOINTS.length ? 'success' : 'running';
  const moving = status === 'running' && Math.hypot(position.x - state.position.x, position.y - state.position.y) > 0.01;
  if (!moving && next === state.next && facing === state.facing && !state.moving && state.riding === input.ride) return state;
  return { ...state, position, next, facing, moving, riding: input.ride, status };
}
