/**
 * 角色移动按键状态。
 *
 * 用浏览器原生键盘事件而非 Phaser 键盘插件，便于精确控制以下规则（需求 FR-01、docs/02 第 5.2 节）：
 * - 焦点在输入框、文本域、下拉框或可编辑元素中时，不响应地图按键。
 * - 窗口失焦、页面隐藏时停止移动并清空按键，避免残留按键导致误移动。
 * - 暂停（功能页打开、表单输入等）期间清空按键并忽略新输入；恢复后需要新的按键才生效。
 *
 * 使用 KeyboardEvent.code（物理键位），不受输入法或大小写影响。
 */

import type { MoveInput } from '../movement/movement';

const CODES = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  ride: ['ShiftLeft', 'ShiftRight'],
} as const satisfies Record<keyof MoveInput, readonly string[]>;

type Control = keyof typeof CODES;
const CONTROL_BY_CODE = new Map<string, Control>(
  (Object.entries(CODES) as [Control, readonly string[]][]).flatMap(([control, codes]) =>
    codes.map((code) => [code, control] as const),
  ),
);

/** 不接收文字输入的 input 类型：焦点在这些控件上时，WASD 仍可驱动角色。 */
const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

/** 事件目标是否为可编辑元素（输入文字时 WASD/E 不能驱动地图）。 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  if (el.closest('textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  const input = el.closest('input');
  return input !== null && !NON_TEXT_INPUT_TYPES.has(input.type);
}

export interface KeyEventLike {
  code: string;
  target: EventTarget | null;
  repeat?: boolean;
}

export class MovementKeys {
  private readonly down = new Set<string>();
  private suspended = false;

  /** 处理 keydown。返回 true 表示该事件属于地图移动控制（调用方可 preventDefault）。 */
  keyDown(event: KeyEventLike): boolean {
    const control = CONTROL_BY_CODE.get(event.code);
    if (!control || this.suspended || isEditableTarget(event.target)) return false;
    if (event.repeat && !this.down.has(event.code)) return false;
    this.down.add(event.code);
    return true;
  }

  /** keyup 总是生效：即使在输入框中松开，也要清除之前记录的按下状态。 */
  keyUp(event: KeyEventLike): void {
    this.down.delete(event.code);
  }

  /** 失焦、页面隐藏、打开功能页时调用。 */
  clear(): void {
    this.down.clear();
  }

  setSuspended(value: boolean): void {
    this.suspended = value;
    this.clear();
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  snapshot(): MoveInput {
    const has = (control: Control) => CODES[control].some((code) => this.down.has(code));
    return { up: has('up'), down: has('down'), left: has('left'), right: has('right'), ride: has('ride') };
  }
}

/** 地图互动键（已确认为 E；docs/02 第 3.3 节）。 */
export const INTERACT_CODE = 'KeyE';

export interface InteractKeyInfo {
  repeat: boolean;
  editable: boolean;
}

/**
 * 把 MovementKeys 接到 window/document 上，返回解绑函数。
 * onInteractKey 在每次 E 的 keydown 时调用（含自动重复与输入框中的按键，由调用方按规则过滤）。
 */
export function bindMovementKeys(
  keys: MovementKeys,
  target: Window = window,
  onInteractKey?: (info: InteractKeyInfo) => boolean,
): () => void {
  const onDown = (event: KeyboardEvent) => {
    if (event.code === INTERACT_CODE && onInteractKey) {
      const handled = onInteractKey({ repeat: event.repeat, editable: isEditableTarget(event.target) });
      if (handled) event.preventDefault();
      return;
    }
    if (keys.keyDown(event)) event.preventDefault();
  };
  const onUp = (event: KeyboardEvent) => keys.keyUp(event);
  const onBlur = () => keys.clear();
  const onFocus = (event: FocusEvent) => { if (isEditableTarget(event.target)) keys.clear(); };
  const onVisibility = () => {
    if (target.document.visibilityState !== 'visible') keys.clear();
  };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  target.document.addEventListener('focusin', onFocus);
  target.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
    target.document.removeEventListener('focusin', onFocus);
    target.document.removeEventListener('visibilitychange', onVisibility);
  };
}
