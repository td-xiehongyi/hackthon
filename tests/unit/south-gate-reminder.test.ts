import { describe, expect, test } from 'vitest';
import type { CharacterState } from '@/game/movement/movement';
import { acknowledgeHelmetReminder, initialHelmetReminder, stepHelmetReminder } from '@/game/south-gate-reminder';

const rider: CharacterState = { position: { x: 335, y: 419 }, mode: 'ride', moving: true, facing: 'up' };

describe('南门警察拦停', () => {
  test('只拦停范围内正在骑行的人，步行、停车和范围外不触发', () => {
    expect(stepHelmetReminder(initialHelmetReminder(), rider).awaitingAcknowledgement).toBe(true);
    for (const character of [
      { ...rider, mode: 'walk' as const }, { ...rider, moving: false },
      { ...rider, position: { x: 335, y: 480 } }, { ...rider, position: { x: 450, y: 419 } },
    ]) expect(stepHelmetReminder(initialHelmetReminder(), character).awaitingAcknowledgement).toBe(false);
  });

  test('进入范围后从步行改成骑行也拦停', () => {
    const walking = stepHelmetReminder(initialHelmetReminder(), { ...rider, mode: 'walk' });
    expect(stepHelmetReminder(walking, rider).awaitingAcknowledgement).toBe(true);
  });

  test('下车、停留或暂停都不能自动放行', () => {
    let state = stepHelmetReminder(initialHelmetReminder(), rider);
    for (let frame = 0; frame < 600; frame++) {
      state = stepHelmetReminder(state, { ...rider, mode: 'walk', moving: false });
    }
    expect(state.awaitingAcknowledgement).toBe(true);
    expect(stepHelmetReminder(state, rider, false).awaitingAcknowledgement).toBe(true);
    expect(stepHelmetReminder(state, { ...rider, position: { x: 335, y: 480 } }).awaitingAcknowledgement).toBe(true);
  });

  test('点击放行后，同次经过不会再次拦停', () => {
    const released = acknowledgeHelmetReminder(stepHelmetReminder(initialHelmetReminder(), rider));
    expect(released.awaitingAcknowledgement).toBe(false);
    expect(stepHelmetReminder(released, rider).awaitingAcknowledgement).toBe(false);
  });

  test('放行后离开外圈，再次骑车经过重新拦停', () => {
    const released = acknowledgeHelmetReminder(stepHelmetReminder(initialHelmetReminder(), rider));
    const left = stepHelmetReminder(released, { ...rider, position: { x: 335, y: 480 } });
    expect(left).toEqual(initialHelmetReminder());
    expect(stepHelmetReminder(left, rider).awaitingAcknowledgement).toBe(true);
  });

  test('放行后在触发边界附近往返不会反复拦停', () => {
    const released = acknowledgeHelmetReminder(stepHelmetReminder(initialHelmetReminder(), rider));
    const edge = stepHelmetReminder(released, { ...rider, position: { x: 335, y: 460 } });
    expect(stepHelmetReminder(edge, rider).awaitingAcknowledgement).toBe(false);
  });

  test('暂停时不触发新的拦停', () => {
    expect(stepHelmetReminder(initialHelmetReminder(), rider, false).awaitingAcknowledgement).toBe(false);
  });
});
