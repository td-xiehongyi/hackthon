import type { CSSProperties } from 'react';

/**
 * 播放 character-playground-prototype 的占位角色雪碧图。
 * 帧坐标与 public/characters/placeholder/character-meta.json 一致；
 * 该角色是代码生成的占位造型，不是正式美术。
 */
const SHEET = '/characters/placeholder/character-sheet.png';
const FRAME = { w: 20, h: 22 } as const;
const SHEET_SIZE = { w: 240, h: 176 } as const;
const ROW: Record<Direction, number> = { down: 0, down_right: 1, right: 2, up_right: 3, up: 4, up_left: 5, left: 6, down_left: 7 };
const ANIM: Record<State, { col: number; frames: number; ms: number }> = {
  idle: { col: 0, frames: 2, ms: 900 },
  walk: { col: 2, frames: 4, ms: 150 },
  run: { col: 6, frames: 6, ms: 90 },
};

export type Direction = 'down' | 'down_right' | 'right' | 'up_right' | 'up' | 'up_left' | 'left' | 'down_left';
export type State = 'idle' | 'walk' | 'run';

interface PixelSpriteProps {
  state?: State;
  direction?: Direction;
  scale?: number;
  className?: string;
  label?: string;
}

export default function PixelSprite({ state = 'idle', direction = 'down', scale = 4, className, label }: PixelSpriteProps) {
  const anim = ANIM[state];
  const x = anim.col * FRAME.w * scale;
  const y = ROW[direction] * FRAME.h * scale;
  const style = {
    width: FRAME.w * scale,
    height: FRAME.h * scale,
    backgroundImage: `url(${SHEET})`,
    backgroundSize: `${SHEET_SIZE.w * scale}px ${SHEET_SIZE.h * scale}px`,
    '--sprite-from': `-${x}px -${y}px`,
    '--sprite-to': `-${x + anim.frames * FRAME.w * scale}px -${y}px`,
    '--sprite-steps': anim.frames,
    '--sprite-duration': `${anim.frames * anim.ms}ms`,
  } as CSSProperties;
  return (
    <span
      className={className ? `pixel-sprite ${className}` : 'pixel-sprite'}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
