import { describe, expect, test } from 'vitest';
import { createRun, stepRun, resumeRun, isOnTrack, type RunState } from '@/features/stadium/campus-run';

describe('校园跑', () => {
  test('未开始、警告和成功状态都不能移动', () => {
    for (const status of ['ready', 'warning', 'success'] as const) {
      const state = { ...createRun(), status };
      expect(stepRun(state, { x: -1, y: 0, ride: false }, 50)).toEqual(state);
    }
  });

  test('持续骑行未满 750ms 不警告，满 750ms 停止并开始角色淡入', () => {
    const state = { ...createRun(), status: 'running' as const, next: 2 };
    expect(stepRun(state, { x: 0, y: 0, ride: true, rideHeldMs: 749 }, 16).status).toBe('running');
    const entering = stepRun(state, { x: -1, y: 0, ride: true, rideHeldMs: 750 }, 16);
    expect(entering.status).toBe('guard-entering');
    expect(entering.position).toEqual(state.position);
    expect(entering.next).toBe(2);
    const partial = stepRun(entering, { x: 1, y: 0, ride: false }, 175);
    expect(partial.status).toBe('guard-entering');
    expect(partial.guardElapsedMs).toBe(175);
    expect(partial.position).toEqual(state.position);
    const almost = stepRun(partial, { x: 1, y: 0, ride: false }, 174);
    expect(almost.status).toBe('guard-entering');
    const warning = stepRun(almost, { x: 1, y: 0, ride: false }, 1);
    expect(warning.status).toBe('warning');
    expect(warning.guardElapsedMs).toBe(350);
    expect(resumeRun(warning)).toEqual(state);
  });

  test('骑行使用骑行状态和速度，但骑车经过打卡点不计入跑步成绩', () => {
    const state = { ...createRun(), status: 'running' as const, position: { x: 700, y: 420 } };
    const riding = stepRun(state, { x: 1, y: 0, ride: true, rideHeldMs: 200 }, 50);
    expect(riding.riding).toBe(true);
    expect(riding.position.x).toBe(715);
    expect(riding.next).toBe(0);
    const walking = stepRun(riding, { x: 0, y: 0, ride: false }, 16);
    expect(walking.riding).toBe(false);
    expect(walking.next).toBe(1);
  });

  test('跑道内移动，草坪与场外不可通行，长帧不能穿过草坪', () => {
    expect(isOnTrack({ x: 500, y: 420 })).toBe(true);
    expect(isOnTrack({ x: 110, y: 270 })).toBe(true);
    expect(isOnTrack({ x: 500, y: 270 })).toBe(false);
    expect(isOnTrack({ x: 50, y: 270 })).toBe(false);
    let state: RunState = { ...createRun(), status: 'running' };
    for (let i = 0; i < 100; i++) state = stepRun(state, { x: 0, y: -1, ride: false }, 5000);
    expect(state.position.y).toBeGreaterThan(390);
    expect(state.next).toBe(0);
  });

  test('跳过、逆序到达与重复经过已完成点不能增加进度', () => {
    const active = { ...createRun(), status: 'running' as const };
    expect(stepRun({ ...active, position: { x: 890, y: 270 } }, { x: 0, y: 0, ride: false }, 16).next).toBe(0);
    expect(stepRun({ ...active, position: { x: 280, y: 420 } }, { x: 0, y: 0, ride: false }, 16).next).toBe(0);
    const first = stepRun({ ...active, position: { x: 720, y: 420 } }, { x: 0, y: 0, ride: false }, 16);
    expect(first.next).toBe(1);
    expect(stepRun(first, { x: 0, y: 0, ride: false }, 16).next).toBe(1);
    expect(stepRun({ ...first, position: { x: 500, y: 420 } }, { x: 0, y: 0, ride: false }, 16).status).toBe('running');
  });

  test('顺序跑过全部打卡点并回到起点才成功，重开清空进度', () => {
    let state: RunState = { ...createRun(), status: 'running' };
    // Hand-checked centerline route, including each curved section.
    const route = [
      [720, 420], [840, 376], [890, 270], [840, 164], [720, 120],
      [500, 120], [280, 120], [160, 164], [110, 270], [160, 376], [280, 420], [500, 420],
    ];
    for (const [x, y] of route) {
      for (let i = 0; i < 500 && Math.hypot(x! - state.position.x, y! - state.position.y) > 4 && state.status === 'running'; i++) {
        state = stepRun(state, { x: x! - state.position.x, y: y! - state.position.y, ride: false }, 16);
      }
    }
    expect(state.next).toBe(8);
    expect(state.status).toBe('success');
    expect(createRun()).toMatchObject({ next: 0, status: 'ready', position: { x: 500, y: 420 } });
  });

  test('斜向移动不加速', () => {
    const state = { ...createRun(), status: 'running' as const };
    const straight = stepRun(state, { x: -1, y: 0, ride: false }, 16);
    const diagonal = stepRun(state, { x: -1, y: -1, ride: false }, 16);
    expect(straight.position.x).toBeCloseTo(497.6);
    expect(Math.hypot(diagonal.position.x - 500, diagonal.position.y - 420)).toBeCloseTo(500 - straight.position.x);
  });
});
