import type { CharacterState } from './movement/movement';

export const SOUTH_GATE_POLICE = {
  x: 386, y: 440, height: 36,
  texture: 'south-gate-police',
  image: '/characters/south-gate-police/standing-v1.png',
  message: '同学停下！！！头盔！！！！',
};

export interface HelmetReminderState {
  warnedThisVisit: boolean;
  awaitingAcknowledgement: boolean;
}

export const initialHelmetReminder = (): HelmetReminderState => ({ warnedThisVisit: false, awaitingAcknowledgement: false });

export function acknowledgeHelmetReminder(previous: HelmetReminderState): HelmetReminderState {
  return { ...previous, awaitingAcknowledgement: false };
}

/** 原图像素坐标；离开更大的外圈才重新允许提醒，避免在边界反复弹出。 */
export function stepHelmetReminder(
  previous: HelmetReminderState, character: CharacterState, active = true,
): HelmetReminderState {
  // 暂停、下车或位置变化都不能替代用户点击放行。
  if (previous.awaitingAcknowledgement || !active) return previous;
  const { x, y } = character.position;
  const inside = x >= 294 && x <= 394 && y >= 375 && y <= 457;
  const outside = x < 282 || x > 406 || y < 363 || y > 469;
  if (outside) return initialHelmetReminder();
  if (inside && character.mode === 'ride' && character.moving && !previous.warnedThisVisit) {
    return { warnedThisVisit: true, awaitingAcknowledgement: true };
  }
  return previous;
}
