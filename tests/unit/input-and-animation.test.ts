import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CharacterManifest } from '@/shared/contracts';
import { MovementKeys } from '@/game/input/movement-keys';
import { ClipPlayer } from '@/game/character/clip-player';

/** 最小 DOM 替身：只实现 isEditableTarget 用到的 closest / isContentEditable / type。 */
function fakeElement(tag: string, attrs: { type?: string; contentEditable?: boolean } = {}) {
  const el = {
    tagName: tag.toUpperCase(),
    type: attrs.type ?? (tag === 'input' ? 'text' : undefined),
    isContentEditable: attrs.contentEditable ?? false,
    closest(selector: string) {
      const tags = selector.split(',').map((s) => s.trim());
      if (tags.includes(tag)) return el;
      if (attrs.contentEditable && tags.some((t) => t.startsWith('[contenteditable'))) return el;
      return null;
    },
  };
  return el as unknown as EventTarget;
}

const canvas = fakeElement('canvas');

describe('移动按键', () => {
  test('WASD 与左右 Shift 映射到移动输入', () => {
    const keys = new MovementKeys();
    for (const code of ['KeyW', 'KeyD', 'ShiftRight']) expect(keys.keyDown({ code, target: canvas })).toBe(true);
    expect(keys.snapshot()).toEqual({ up: true, down: false, left: false, right: true, ride: true });
    keys.keyUp({ code: 'ShiftRight', target: canvas });
    expect(keys.snapshot().ride).toBe(false);
  });

  test('E 与其他按键不属于移动控制', () => {
    const keys = new MovementKeys();
    expect(keys.keyDown({ code: 'KeyE', target: canvas })).toBe(false);
    expect(keys.keyDown({ code: 'ArrowUp', target: canvas })).toBe(false);
  });

  test('焦点在文字输入框、文本域、可编辑元素中时不响应', () => {
    const keys = new MovementKeys();
    for (const target of [
      fakeElement('input'),
      fakeElement('input', { type: 'search' }),
      fakeElement('textarea'),
      fakeElement('select'),
      fakeElement('div', { contentEditable: true }),
    ]) {
      expect(keys.keyDown({ code: 'KeyW', target })).toBe(false);
    }
    expect(keys.snapshot().up).toBe(false);
  });

  test('复选框、按钮等非文字控件获得焦点时仍可移动', () => {
    const keys = new MovementKeys();
    expect(keys.keyDown({ code: 'KeyA', target: fakeElement('input', { type: 'checkbox' }) })).toBe(true);
    expect(keys.keyDown({ code: 'KeyS', target: fakeElement('button') })).toBe(true);
  });

  test('在输入框中松开按键也会清除之前的按下状态', () => {
    const keys = new MovementKeys();
    keys.keyDown({ code: 'KeyD', target: canvas });
    keys.keyUp({ code: 'KeyD', target: fakeElement('input') });
    expect(keys.snapshot().right).toBe(false);
  });

  test('失焦清键；暂停时清键并忽略新输入；恢复后需要新的按键', () => {
    const keys = new MovementKeys();
    keys.keyDown({ code: 'KeyW', target: canvas });
    keys.clear();
    expect(keys.snapshot().up).toBe(false);

    keys.keyDown({ code: 'KeyS', target: canvas });
    keys.setSuspended(true);
    expect(keys.snapshot().down).toBe(false);
    expect(keys.keyDown({ code: 'KeyS', target: canvas })).toBe(false);
    keys.setSuspended(false);
    // 暂停前一直按着的键不会自动恢复生效。
    expect(keys.snapshot().down).toBe(false);
  });
});

describe('动画播放', () => {
  const manifest: CharacterManifest = JSON.parse(
    readFileSync('public/characters/temp-prototype/manifest.json', 'utf-8'),
  );

  test('按逐帧 durationMs 推进并循环', () => {
    const player = new ClipPlayer(manifest);
    const sel = { mode: 'walk', facing: 'down', action: 'move' } as const;
    const clip = manifest.clips.find((c) => c.mode === 'walk' && c.facing === 'down' && c.action === 'move')!;
    player.update(sel, 0);
    expect(player.currentFrameIndex).toBe(0);
    player.update(sel, clip.frames[0]!.durationMs);
    expect(player.currentFrameIndex).toBe(1);
    const total = clip.frames.reduce((s, f) => s + f.durationMs, 0);
    player.update(sel, total);
    expect(player.currentFrameIndex).toBe(1);
  });

  test('切换状态（换向、换模式）从第 0 帧开始，帧取自对应状态', () => {
    const player = new ClipPlayer(manifest);
    player.update({ mode: 'walk', facing: 'down', action: 'move' }, 0);
    player.update({ mode: 'walk', facing: 'down', action: 'move' }, 400);
    const frame = player.update({ mode: 'ride', facing: 'left', action: 'move' }, 16);
    expect(player.currentFrameIndex).toBe(0);
    const expected = manifest.clips.find((c) => c.mode === 'ride' && c.facing === 'left' && c.action === 'move')!;
    expect(frame.rect).toEqual(expected.frames[0]!.rect);
  });

  test('长时间卡顿后不会逐帧空转，仍落在合法帧上', () => {
    const player = new ClipPlayer(manifest);
    const sel = { mode: 'ride', facing: 'up', action: 'move' } as const;
    player.update(sel, 0);
    player.update(sel, 1e9);
    expect(player.currentFrameIndex).toBeGreaterThanOrEqual(0);
    expect(player.currentFrameIndex).toBeLessThan(6);
  });
});
