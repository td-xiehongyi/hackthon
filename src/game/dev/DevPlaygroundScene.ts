/**
 * 开发测试场景（临时）。
 *
 * **只用于开发自检，不是正式探索场景。** 使用合成测试世界与队友原型角色（临时素材），
 * 在 v20 地图标定完成前验证：manifest 加载与帧裁切、四方向/步行骑行切换、
 * 锚点对齐脚底、WASD/Shift 移动、脚底碰撞、桥面与水域、窄巷、遮挡排序、
 * 镜头跟随，失焦/输入框/暂停时停止移动，以及临时互动范围内按 E 请求打开功能页。
 *
 * 所有移动与碰撞判定都在 movement.ts 纯逻辑中完成，本场景只负责渲染和输入接线。
 */

import * as Phaser from 'phaser';
import type { PlaceId, Point } from '@/shared/contracts';
import { getPlace } from '@/shared/place-registry';
import { CharacterSprite, preloadCharacter } from '../character/character-sprite';
import { bindMovementKeys, MovementKeys, type InteractKeyInfo } from '../input/movement-keys';
import { activeInteractions, interactRequest, selectTarget, type ActiveInteraction } from '../interaction/interaction';
import { DEV_TUNING, footprintRect, step, type CharacterState, type WalkableWorld } from '../movement/movement';
import {
  PLAYGROUND_COLLISION,
  PLAYGROUND_INTERACTIONS,
  PLAYGROUND_OCCLUDERS,
  PLAYGROUND_RECTS,
  PLAYGROUND_SIZE,
  PLAYGROUND_SPAWN,
  PLAYGROUND_WALKABLE,
} from './playground-world';

/** 显示倍率（开发调试值，不是已确认的地图显示比例）。 */
const CHARACTER_SCALE = 1;
const CAMERA_ZOOM = 3;

export interface PlaygroundSnapshot {
  x: number;
  y: number;
  facing: CharacterState['facing'];
  mode: CharacterState['mode'];
  moving: boolean;
  frame: string;
  characterDepth: number;
  occluderDepth: number;
  suspended: boolean;
  /** 当前互动目标；范围外为 null。 */
  target: PlaceId | null;
}

export interface PlaygroundCallbacks {
  onReady: () => void;
  onError: (message: string) => void;
  onSnapshot: (snapshot: PlaygroundSnapshot) => void;
  /**
   * 在有效范围内新按下 E 时调用，对应 request-open-place { placeId }。
   * 附带按 E 时的脚底位置与朝向，供宿主保存返回上下文。
   */
  onRequestOpenPlace: (request: { placeId: PlaceId; position: Point; facing: CharacterState['facing'] }) => void;
}

export class DevPlaygroundScene extends Phaser.Scene {
  readonly keys = new MovementKeys();
  private unbindKeys: (() => void) | null = null;
  private state: CharacterState = { position: { ...PLAYGROUND_SPAWN }, facing: 'down', mode: 'walk', moving: false };
  private character: CharacterSprite | null = null;
  private occluder: Phaser.GameObjects.Graphics | null = null;
  private footprintGfx: Phaser.GameObjects.Graphics | null = null;
  private readonly world: WalkableWorld = { walkableAreas: PLAYGROUND_WALKABLE, collisionAreas: PLAYGROUND_COLLISION };
  private lastSnapshot = '';
  private readonly interactions: ActiveInteraction[] = activeInteractions(PLAYGROUND_INTERACTIONS);
  private target: PlaceId | null = null;
  private promptText: Phaser.GameObjects.Text | null = null;

  constructor(private readonly callbacks: PlaygroundCallbacks) {
    super('dev-playground');
  }

  preload() {
    this.load.once('loaderror', () => this.callbacks.onError('临时角色素材加载失败'));
    preloadCharacter(this);
  }

  create() {
    const created = CharacterSprite.create(this, CHARACTER_SCALE);
    if ('error' in created) {
      this.callbacks.onError(created.error);
      return;
    }
    this.character = created;

    this.drawWorld();
    this.footprintGfx = this.add.graphics().setDepth(10_000);
    this.applyFrame(0);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, PLAYGROUND_SIZE.width, PLAYGROUND_SIZE.height);
    camera.setZoom(CAMERA_ZOOM);
    camera.startFollow(this.character.image, true);
    camera.setRoundPixels(true);

    this.promptText = this.add
      .text(0, 0, '', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '6px',
        color: '#fffdf2',
        backgroundColor: '#254d3bee',
        padding: { x: 3, y: 2 },
      })
      .setResolution(6)
      .setOrigin(0.5, 1)
      .setDepth(20_000)
      .setVisible(false);

    this.unbindKeys = bindMovementKeys(this.keys, window, (info) => this.handleInteractKey(info));
    this.events.once('shutdown', () => this.unbindKeys?.());
    this.events.once('destroy', () => this.unbindKeys?.());
    this.callbacks.onReady();
    this.publish();
  }

  update(_time: number, deltaMs: number) {
    if (!this.character) return;
    const input = this.keys.snapshot();
    this.state = step(this.state, input, deltaMs / 1000, this.world, DEV_TUNING);
    this.target = this.keys.isSuspended() ? null : selectTarget(this.state.position, this.interactions);
    this.applyFrame(deltaMs);
    this.publish();
  }

  /** 暂停/恢复（功能页、表单等）。暂停时清空按键，恢复后需要新按键。 */
  setSuspended(value: boolean) {
    this.keys.setSuspended(value);
  }

  /** 恢复到指定位置与朝向（返回校园时用），同时清键。 */
  restore(position: Point, facing: CharacterState['facing']) {
    this.keys.clear();
    this.state = { position: { ...position }, facing, mode: 'walk', moving: false };
  }

  /** 开发面板用：瞬移到测试落点（仅测试场景，正式场景的快速移动须使用已核验安全点）。 */
  devTeleport(position: Point) {
    this.restore(position, this.state.facing);
  }

  get currentState(): CharacterState {
    return { ...this.state, position: { ...this.state.position } };
  }

  /**
   * E 键：只有范围内的一次新按下才发请求。
   * 判定只在 keydown 那一刻进行，因此按住 E 走入范围不会打开；自动重复事件被忽略。
   */
  private handleInteractKey(info: InteractKeyInfo): boolean {
    if (info.editable) return false; // 输入框中的 E 保留给输入框
    this.target = this.keys.isSuspended() ? null : selectTarget(this.state.position, this.interactions);
    const placeId = interactRequest(info, this.keys.isSuspended(), this.target);
    if (!placeId) return !info.repeat && this.target !== null;
    this.callbacks.onRequestOpenPlace({
      placeId,
      position: { ...this.state.position },
      facing: this.state.facing,
    });
    return true;
  }

  private applyFrame(deltaMs: number) {
    this.character!.update(this.state, deltaMs);

    const fp = this.state.mode === 'ride' ? DEV_TUNING.rideFootprint : DEV_TUNING.walkFootprint;
    const r = footprintRect(this.state.position, fp);
    this.footprintGfx!.clear().lineStyle(1, 0xff2d55, 1).strokeRect(r.x, r.y, r.width, r.height);

    // 互动提示：显示“按 E 进入【地点名称】”，与实际打开对象使用同一 target。
    const place = this.target ? getPlace(this.target) : undefined;
    if (place && this.promptText) {
      this.promptText
        .setText(`按 E 进入【${place.name}】`)
        .setPosition(Math.round(this.state.position.x), Math.round(this.state.position.y) - 23)
        .setVisible(true);
    } else {
      this.promptText?.setVisible(false);
    }
  }

  private publish() {
    const snapshot: PlaygroundSnapshot = {
      x: Math.round(this.state.position.x * 10) / 10,
      y: Math.round(this.state.position.y * 10) / 10,
      facing: this.state.facing,
      mode: this.state.mode,
      moving: this.state.moving,
      frame: this.character?.currentFrameName ?? '',
      characterDepth: this.character?.image.depth ?? 0,
      occluderDepth: this.occluder?.depth ?? 0,
      suspended: this.keys.isSuspended(),
      target: this.target,
    };
    const key = JSON.stringify(snapshot);
    if (key === this.lastSnapshot) return;
    this.lastSnapshot = key;
    this.callbacks.onSnapshot(snapshot);
  }

  private drawWorld() {
    const g = this.add.graphics().setDepth(-1);
    g.fillStyle(0x3d5a44, 1).fillRect(0, 0, PLAYGROUND_SIZE.width, PLAYGROUND_SIZE.height);
    for (const area of PLAYGROUND_WALKABLE) {
      g.fillStyle(area.id === 'bridge' ? 0xb48a5a : 0xd9d2b8, 1);
      fillPoly(g, area.polygon);
    }
    for (const area of PLAYGROUND_COLLISION) {
      if (area.id === 'tree-trunk') continue; // 树干由遮挡物绘制
      g.fillStyle(area.id.startsWith('water') ? 0x4f9bd9 : 0x8a6f5c, 1);
      fillPoly(g, area.polygon);
      g.lineStyle(1, 0x2b2b2b, 0.6);
      strokePoly(g, area.polygon);
    }
    // 临时互动范围（虚线框 + 入口参考点）。
    const zoneColor: Record<string, number> = {
      xiaoxiang_library: 0x2f6fd6,
      xiaoxiang_teaching_group: 0xc0392b,
      xiaoxiang_sports_ground: 0x8e44ad,
    };
    for (const zone of this.interactions) {
      const color = zoneColor[zone.placeId] ?? 0x333333;
      g.fillStyle(color, 0.12);
      fillPoly(g, zone.triggerPolygon);
      g.lineStyle(1, color, 0.9);
      strokePoly(g, zone.triggerPolygon);
      g.fillStyle(color, 1).fillCircle(zone.entrancePoint.x, zone.entrancePoint.y, 2);
    }

    // 标签（测试世界坐标，与 v20 无关）
    const label = (text: string, x: number, y: number) =>
      this.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '8px', color: '#1d2a22' }).setResolution(4).setDepth(-0.5);
    const R = PLAYGROUND_RECTS;
    label('测试建筑', R.building.x + 8, R.building.y + 14).setColor('#fff');
    label('窄巷（可骑行）', R.lane.x + 12, R.lane.y + 40);
    label('桥', R.bridge.x + 34, R.bridge.y + 7);
    label('水域', R.waterSouth.x + 28, R.waterSouth.y + 60).setColor('#fff');
    label('东岸', R.eastBank.x + 40, R.eastBank.y + 90);
    label('临时·图书馆', 58, 117).setColor('#1f4f9f');
    label('临时·教学楼群', 170, 175).setColor('#8e2b20');
    label('临时·副场', 240, 175).setColor('#6c2f86');

    // 遮挡物：树（树冠 + 树干），深度 = 树干底部基线。
    const tree = PLAYGROUND_OCCLUDERS[0];
    this.occluder = this.add.graphics().setDepth(tree.depthAnchorY);
    const { x, y, width, height } = tree.rect;
    this.occluder.fillStyle(0x6b4a2b, 1).fillRect(x + width / 2 - 3, y + height - 14, 6, 14);
    this.occluder.fillStyle(0x2f7d3a, 0.95).fillCircle(x + width / 2, y + 16, 16);
  }
}

function fillPoly(g: Phaser.GameObjects.Graphics, poly: readonly Point[]) {
  g.beginPath();
  g.moveTo(poly[0]!.x, poly[0]!.y);
  for (const p of poly.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.fillPath();
}

function strokePoly(g: Phaser.GameObjects.Graphics, poly: readonly Point[]) {
  g.beginPath();
  g.moveTo(poly[0]!.x, poly[0]!.y);
  for (const p of poly.slice(1)) g.lineTo(p.x, p.y);
  g.closePath();
  g.strokePath();
}
