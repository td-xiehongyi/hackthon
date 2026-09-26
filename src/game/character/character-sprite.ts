/**
 * 角色精灵（Phaser 侧）：加载 manifest 与雪碧图、注册帧、按状态播放、锚点对齐脚底。
 *
 * 测试场景与正式地图场景共用本模块，避免两份渲染逻辑各自演进。
 * 移动与碰撞仍由 movement.ts 纯逻辑负责，这里只管“画在哪、画哪一帧”。
 */

import * as Phaser from 'phaser';
import type { CharacterManifest, Point, SpriteFrame } from '@/shared/contracts';
import type { CharacterState } from '../movement/movement';
import { ClipPlayer } from './clip-player';
import { validateManifest } from './manifest';

/** 当前使用的临时角色素材目录（队友原型转换而来，不是 E 的正式交付）。 */
export const TEMP_CHARACTER_DIR = '/characters/temp-prototype';
/** E 交付后只需切换本地目录；未设置时明确使用临时角色。 */
export const CHARACTER_DIR = import.meta.env.VITE_CHARACTER_DIR || TEMP_CHARACTER_DIR;
export const USING_TEMP_CHARACTER = CHARACTER_DIR === TEMP_CHARACTER_DIR;
const MANIFEST_KEY = 'character-manifest';

function frameName(rect: SpriteFrame['rect']) {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`;
}

/** 在场景 preload() 中调用。 */
export function preloadCharacter(scene: Phaser.Scene, dir = CHARACTER_DIR) {
  scene.load.json(MANIFEST_KEY, `${dir}/manifest.json`);
  scene.load.once(
    `filecomplete-json-${MANIFEST_KEY}`,
    (_key: string, _type: string, data: CharacterManifest) => {
      for (const sheet of data.sheets ?? []) scene.load.image(`character:${sheet.id}`, `${dir}/${sheet.url}`);
    },
  );
}

export class CharacterSprite {
  readonly image: Phaser.GameObjects.Image;
  private readonly player: ClipPlayer;
  private frame: SpriteFrame;

  private constructor(scene: Phaser.Scene, manifest: CharacterManifest, scale: number) {
    this.player = new ClipPlayer(manifest);
    this.frame = this.player.update({ mode: 'walk', facing: 'down', action: 'idle' }, 0);
    this.image = scene.add.image(0, 0, `character:${this.frame.sheetId}`, frameName(this.frame.rect)).setScale(scale);
  }

  /**
   * 在 create() 中调用。校验 manifest 与雪碧图实际尺寸后注册帧；
   * 不符合契约时返回错误信息而不是带着坏素材继续运行。
   */
  static create(scene: Phaser.Scene, scale = 1): CharacterSprite | { error: string } {
    const manifest = scene.cache.json.get(MANIFEST_KEY) as CharacterManifest | undefined;
    const problems = validateManifest(manifest);
    if (!manifest || problems.length > 0) {
      return { error: `角色 manifest 不符合契约：${problems.slice(0, 3).join('；')}` };
    }
    for (const sheet of manifest.sheets) {
      const key = `character:${sheet.id}`;
      if (!scene.textures.exists(key)) return { error: `雪碧图 ${sheet.id} 未能加载` };
      const texture = scene.textures.get(key);
      const source = texture.getSourceImage();
      if (source.width !== sheet.width || source.height !== sheet.height) {
        return { error: `雪碧图 ${sheet.id} 实际尺寸与 manifest 声明不符` };
      }
      for (const clip of manifest.clips) {
        for (const frame of clip.frames) {
          if (frame.sheetId !== sheet.id) continue;
          const name = frameName(frame.rect);
          if (!texture.has(name)) texture.add(name, 0, frame.rect.x, frame.rect.y, frame.rect.width, frame.rect.height);
        }
      }
    }
    return new CharacterSprite(scene, manifest, scale);
  }

  /** 按角色状态推进动画并摆放到脚底位置；深度 = 脚底 y，用于遮挡排序。 */
  update(state: CharacterState, deltaMs: number) {
    this.frame = this.player.update(
      { mode: state.mode, facing: state.facing, action: state.moving ? 'move' : 'idle' },
      deltaMs,
    );
    this.place(state.position);
  }

  place(position: Point) {
    const f = this.frame;
    this.image.setTexture(`character:${f.sheetId}`, frameName(f.rect));
    // 锚点对齐世界脚底点：换帧、换向、切换步行/骑行时落地点不变。
    this.image.setOrigin(f.anchor.x / f.rect.width, f.anchor.y / f.rect.height);
    this.image.setPosition(Math.round(position.x), Math.round(position.y));
    this.image.setDepth(position.y);
  }

  get currentFrameName() {
    return frameName(this.frame.rect);
  }
}
