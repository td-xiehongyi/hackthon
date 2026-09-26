/**
 * 角色动画播放（纯逻辑）。
 *
 * 按 manifest 的逐帧 durationMs 推进；切换到不同状态时从第 0 帧重新开始，
 * 同一状态持续时保持节奏。动画节奏不等于移动速度（docs/04 第 5 节）。
 */

import type {
  CharacterAction,
  CharacterClip,
  CharacterManifest,
  Direction,
  MovementMode,
  SpriteFrame,
} from '@/shared/contracts';
import { clipKey } from './manifest';

export interface ClipSelector {
  mode: MovementMode;
  facing: Direction;
  action: CharacterAction;
}

export class ClipPlayer {
  private readonly clips = new Map<string, CharacterClip>();
  private currentKey = '';
  private frameIndex = 0;
  private elapsedInFrame = 0;

  constructor(manifest: CharacterManifest) {
    for (const clip of manifest.clips) this.clips.set(clipKey(clip.mode, clip.facing, clip.action), clip);
  }

  /** 推进 dtMs 毫秒并返回当前应显示的帧。 */
  update(selector: ClipSelector, dtMs: number): SpriteFrame {
    const key = clipKey(selector.mode, selector.facing, selector.action);
    const clip = this.clips.get(key);
    if (!clip) throw new Error(`manifest 缺少状态 ${key}`);
    if (key !== this.currentKey) {
      this.currentKey = key;
      this.frameIndex = 0;
      this.elapsedInFrame = 0;
      return clip.frames[0]!;
    }
    this.elapsedInFrame += Math.max(0, dtMs);
    // 长时间卡顿后不逐帧空转：先对整段循环取余。
    const total = clip.frames.reduce((sum, f) => sum + f.durationMs, 0);
    if (clip.loop && this.elapsedInFrame > total) this.elapsedInFrame %= total;
    while (this.elapsedInFrame >= clip.frames[this.frameIndex]!.durationMs) {
      this.elapsedInFrame -= clip.frames[this.frameIndex]!.durationMs;
      if (this.frameIndex + 1 < clip.frames.length) this.frameIndex += 1;
      else if (clip.loop) this.frameIndex = 0;
      else { this.elapsedInFrame = 0; break; }
    }
    return clip.frames[this.frameIndex]!;
  }

  get currentFrameIndex() {
    return this.frameIndex;
  }
}
