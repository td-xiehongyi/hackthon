/**
 * 校园地图场景（v20 运行底图）。
 *
 * 提供两种镜头模式：
 * - **浏览**：拖动、滚轮/按钮缩放、适应窗口（原地图预览功能）。
 * - **角色**：放入角色，WASD 跑动、按住 Shift 骑行，镜头跟随。
 *
 * 通行范围来自 public/maps/campus-v20.annotations.json：底图提取叠加独立人工修正规则。
 * 状态为 pending（边界待用户核对）。草地、操场、路旁与建筑旁树木开放，桥面连接两岸。
 * 标注加载失败或不匹配时停用移动，保留地图浏览并明确提示。
 * 出生点使用标注中已核验的潇湘校区图书馆入口；缺失时回退到地图中心附近可站立的位置。
 */

import * as Phaser from 'phaser';
import {
  MAP_HEIGHT_PX,
  MAP_ID,
  MAP_IMAGE_PATH,
  MAP_DISPLAY_IMAGE_PATH,
  MAP_WIDTH_PX,
  type MapAnnotation,
  type Point,
  type PlaceId,
} from '@/shared/contracts';
import type { OpenContext } from '@/app/place-session';
import { validateAnnotation } from './map-data';
import { activeInteractions, selectTarget, interactRequest, resolveReturnPosition, type ActiveInteraction } from './interaction/interaction';
import { CharacterSprite, preloadCharacter } from './character/character-sprite';
import { SouthGatePolice } from './SouthGatePolice';
import { SOUTH_GATE_POLICE } from './south-gate-reminder';
import { CHARACTER_CHOICES, type CharacterChoice } from './character/choices';
import { bindMovementKeys, MovementKeys, type InteractKeyInfo } from './input/movement-keys';
import {
  DEV_TUNING,
  nearestStandable,
  footprintFits,
  rasterizeWorld,
  step,
  type CharacterState,
  type WalkableWorld,
} from './movement/movement';

export type ViewMode = 'browse' | 'character';

/** 通行标注可用，或因缺失/损坏而禁用移动。 */
export type CollisionSource = 'annotation' | 'unavailable';

export const ANNOTATION_PATH = MAP_IMAGE_PATH.replace(/\.png$/, '.annotations.json');

export interface CharacterStatus {
  x: number;
  y: number;
  facing: CharacterState['facing'];
  mode: CharacterState['mode'];
  moving: boolean;
}

type MapCallbacks = {
  onReady: () => void;
  onError: () => void;
  onZoom: (zoom: number) => void;
  onCharacterError?: (message: string) => void;
  onCharacterStatus?: (status: CharacterStatus) => void;
  /** 场景实际进入的模式（角色素材加载失败时会停留在浏览模式）。 */
  onViewModeChange?: (mode: ViewMode) => void;
  onCollisionSource?: (source: CollisionSource, detail: string) => void;
  onAnnotation?: (annotation: MapAnnotation | null) => void;
  onTarget?: (target: PlaceId | null) => void;
  onRequestOpen?: (context: OpenContext) => void;
};

/**
 * 没有有效标注时关闭移动，不能把整张图片视为可行走区域。
 */
export const BLOCKED_WORLD: WalkableWorld = {
  walkableAreas: [],
  collisionAreas: [],
};

/** 已核验出生点不可用时的兜底起点：地图中心。 */
export const UNCALIBRATED_START: Point = { x: Math.round(MAP_WIDTH_PX / 2), y: Math.round(MAP_HEIGHT_PX / 2) };

/** 已确认的初始角色镜头倍率；交互返回时沿用用户当前选择。 */
const CHARACTER_ZOOM = 2.33;
const MAX_ZOOM = 6;

export class CampusMapScene extends Phaser.Scene {
  private mapWidth = 0;
  private mapHeight = 0;
  private minimumZoom = 1;
  private characterZoom = CHARACTER_ZOOM;
  private ready = false;
  private buildingHighlight: Phaser.GameObjects.Graphics | null = null;
  private viewMode: ViewMode = 'browse';
  private suspended = false;
  readonly keys = new MovementKeys();
  private unbindKeys: (() => void) | null = null;
  private character: CharacterSprite | null = null;
  private state: CharacterState = { position: { ...UNCALIBRATED_START }, facing: 'down', mode: 'walk', moving: false };
  private lastStatus = '';
  private world: WalkableWorld = BLOCKED_WORLD;
  private annotation: MapAnnotation | null = null;
  private interactions: ActiveInteraction[] = [];
  private target: PlaceId | null = null;
  private movementAvailable = false;
  private overlay: Phaser.GameObjects.Image | null = null;
  private southGatePolice: SouthGatePolice | null = null;

  constructor(
    private readonly callbacks: MapCallbacks,
    /** 加载完成后默认进入的模式：默认直接放出角色。 */
    private readonly initialMode: ViewMode = 'character',
    private readonly characterChoice: CharacterChoice = CHARACTER_CHOICES[0],
  ) {
    super('campus-map');
  }

  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'campus') this.callbacks.onError();
      else if (file.key !== 'annotation') this.callbacks.onCharacterError?.('角色素材加载失败');
    });
    this.load.image('campus', MAP_DISPLAY_IMAGE_PATH);
    this.load.image(SOUTH_GATE_POLICE.texture, SOUTH_GATE_POLICE.image);
    this.load.json('annotation', ANNOTATION_PATH);
    this.load.once('filecomplete-json-annotation', (_key: string, _type: string, data: unknown) => {
      if (validateAnnotation(data).length) return;
      for (const item of (data as MapAnnotation).occluders) {
        if (item.verificationStatus === 'verified') this.load.image(`occluder:${item.id}`, item.imagePath);
      }
    });
    preloadCharacter(this, this.characterChoice.dir);
  }

  create() {
    if (!this.textures.exists('campus')) return;
    const source = this.textures.get('campus').getSourceImage();
    this.mapWidth = source.width;
    this.mapHeight = source.height;
    this.add.image(0, 0, 'campus').setOrigin(0).setDepth(-1_000_000);
    this.addSouthGateForeground();
    if (this.textures.exists(SOUTH_GATE_POLICE.texture)) {
      this.southGatePolice = new SouthGatePolice(this, () => this.syncKeySuspension());
    }
    this.cameras.main.setRoundPixels(true);
    this.buildingHighlight = this.add.graphics().setDepth(90_000);
    this.ready = true;
    this.setupWorld();
    for (const item of this.annotation?.occluders ?? []) {
      if (item.verificationStatus !== 'verified' || !this.textures.exists(`occluder:${item.id}`)) continue;
      this.add.image(item.rect.x, item.rect.y, `occluder:${item.id}`).setOrigin(0)
        .setDisplaySize(item.rect.width, item.rect.height).setDepth(item.depthAnchorY);
    }

    const created = CharacterSprite.create(this, this.characterChoice.scale, this.characterChoice.hue);
    if ('error' in created) {
      this.callbacks.onCharacterError?.(created.error);
    } else {
      this.character = created;
      this.character.update(this.state, 0);
      this.character.image.setVisible(false);
    }

    this.fitToWindow();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.suspended || this.southGatePolice?.isBlocking || pointer.getDistance() < 4) return;
      if (this.viewMode !== 'browse') this.setViewMode('browse');
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _objects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => this.changeZoom(Math.exp(-deltaY * 0.001)));

    this.unbindKeys = bindMovementKeys(this.keys, window, (info) => this.handleInteractKey(info), () => {
      if (this.viewMode === 'browse' && !this.suspended && !this.southGatePolice?.isBlocking && !this.input.activePointer.isDown) {
        this.setViewMode('character', false);
      }
    });
    this.syncKeySuspension();

    this.scale.on('resize', this.fitToWindow, this);
    this.events.once('shutdown', () => {
      this.ready = false;
      this.unbindKeys?.();
      this.scale.off('resize', this.fitToWindow, this);
    });
    this.callbacks.onReady();
    if (this.initialMode === 'character' && this.character && this.movementAvailable) this.setViewMode('character');
    else this.callbacks.onViewModeChange?.('browse');
  }

  /** 复用底图原像素，只让门框参与脚底深度排序；门洞和周围地面保持透明。 */
  private addSouthGateForeground() {
    const texture = this.textures.createCanvas('south-gate-foreground', 110, 69);
    if (!texture) return;
    const context = texture.context;
    context.translate(-282, -345);
    context.beginPath();
    const outlines = [
      // 左门柱、柱头和石座。
      [[298, 347], [316, 347], [316, 351], [313, 355], [313, 363], [317, 368], [315, 377],
        [314, 401], [317, 404], [317, 412], [295, 412], [295, 405], [298, 401], [299, 378],
        [297, 374], [297, 366], [299, 363], [299, 355], [297, 350]],
      // 横梁与牌匾。
      [[312, 355], [364, 355], [366, 371], [361, 375], [316, 375], [311, 371]],
      // 右门柱和石座；右侧原有“南门”标牌像素保持原样。
      [[363, 347], [379, 347], [380, 351], [377, 355], [377, 365], [378, 401],
        [381, 404], [381, 412], [360, 412], [360, 405], [362, 401], [362, 378],
        [359, 373], [360, 366], [363, 363], [363, 355], [361, 351]],
    ];
    for (const points of outlines) {
      context.moveTo(points[0]![0]!, points[0]![1]!);
      for (const [x, y] of points.slice(1)) context.lineTo(x!, y!);
      context.closePath();
    }
    for (const x of [321, 333, 345, 356]) context.rect(x, 351, 3, 5);
    context.clip();
    context.drawImage(this.textures.get('campus').getSourceImage() as HTMLImageElement, 0, 0);
    texture.refresh();
    this.add.image(282, 345, texture.key).setOrigin(0).setDepth(413);
  }

  update(_time: number, deltaMs: number) {
    if (!this.character || this.viewMode !== 'character') {
      this.southGatePolice?.hide();
      return;
    }
    const wasBlocked = this.southGatePolice?.isBlocking;
    if (!wasBlocked) this.state = step(this.state, this.keys.snapshot(), deltaMs / 1000, this.world, DEV_TUNING);
    this.southGatePolice?.update(this.state, !this.suspended);
    if (this.southGatePolice?.isBlocking) {
      this.state = { ...this.state, mode: 'walk', moving: false };
      if (!wasBlocked) this.syncKeySuspension();
    }
    this.updateTarget();
    this.character.update(this.state, deltaMs);
    this.publishStatus();
  }

  /** 读取并校验标注；不可用时保留只读地图。 */
  private setupWorld() {
    const value: unknown = this.cache.json.get('annotation');
    let reason = validateAnnotation(value).slice(0, 2).join('；');
    const annotation = reason ? null : value as MapAnnotation;
    this.annotation = annotation;
    this.callbacks.onAnnotation?.(annotation);
    if (annotation && annotation.walkableAreas.length === 0) reason = '通行标注中没有行走区';
    if (reason) {
      this.world = BLOCKED_WORLD;
      this.callbacks.onCollisionSource?.('unavailable', reason);
      return;
    } else {
      this.world = rasterizeWorld(
        { walkableAreas: annotation!.walkableAreas, collisionAreas: annotation!.collisionAreas },
        this.mapWidth,
        this.mapHeight,
      );
      this.callbacks.onCollisionSource?.(
        'annotation',
        annotation!.annotationStatus === 'verified' ? '已核验' : '通行规则已应用，边界待核验',
      );
      this.buildOverlay();
    }
    const spawn = annotation!.safePoints.find((p) => p.verificationStatus === 'verified' && p.usage.includes('spawn') &&
      footprintFits(p.position, DEV_TUNING.rideFootprint, this.world));
    const start = spawn?.position ?? nearestStandable(UNCALIBRATED_START, DEV_TUNING.rideFootprint, this.world);
    if (!start) {
      this.callbacks.onCollisionSource?.('unavailable', '地图中没有可站立的起点');
      return;
    }
    this.state = { ...this.state, position: { ...start } };
    this.movementAvailable = true;
    this.interactions = activeInteractions(annotation!.interactions);
  }

  private updateTarget() {
    const target = this.keys.isSuspended() ? null : selectTarget(this.state.position, this.interactions);
    if (target === this.target) return;
    this.target = target;
    this.updateBuildingHighlight();
    this.callbacks.onTarget?.(target);
  }

  private updateBuildingHighlight() {
    const graphics = this.buildingHighlight;
    if (!graphics) return;
    graphics.clear();
    const record = this.annotation?.interactions.find((item) => item.placeId === this.target);
    const polygon = record?.highlightPolygon ?? record?.triggerPolygon;
    if (!polygon?.length) return;
    const points = polygon.map(({ x, y }) => new Phaser.Math.Vector2(x, y));
    // 同一目标同时控制轮廓、提示和 E 键请求；不改变底图或碰撞范围。
    graphics.fillStyle(0xffd35a, 0.24);
    graphics.fillPoints(points, true);
    graphics.lineStyle(7, 0xffcf40, 0.3);
    graphics.strokePoints(points, true);
    graphics.lineStyle(2, 0xfff3b0, 1);
    graphics.strokePoints(points, true);
  }

  private handleInteractKey(info: InteractKeyInfo): boolean {
    this.updateTarget();
    const placeId = interactRequest(info, this.keys.isSuspended(), this.target);
    if (!placeId) return false;
    this.callbacks.onRequestOpen?.({ placeId, entryPosition: { ...this.state.position }, facing: this.state.facing, mapId: MAP_ID });
    return true;
  }

  canOpen(context: OpenContext): boolean {
    return !this.keys.isSuspended() && context.mapId === MAP_ID &&
      selectTarget(this.state.position, this.interactions) === context.placeId &&
      context.entryPosition.x === this.state.position.x && context.entryPosition.y === this.state.position.y;
  }

  restore(context: OpenContext): string | null {
    const result = resolveReturnPosition(context, this.annotation?.interactions ?? [], this.annotation?.safePoints ?? [], this.world, DEV_TUNING.walkFootprint);
    if (result.kind === 'error') return result.message;
    this.state = { position: result.position, facing: context.facing, mode: 'walk', moving: false };
    this.keys.clear();
    this.character?.update(this.state, 0);
    this.publishStatus(true);
    this.setSuspended(false);
    return null;
  }

  teleport(id: string): string | null {
    if (this.southGatePolice?.isBlocking) return '请先关闭地图，点击警察对话框后通行。';
    const safe = this.annotation?.safePoints.find((p) => p.id === id && p.verificationStatus === 'verified' && p.usage.includes('teleport'));
    if (!safe || !this.movementAvailable || !footprintFits(safe.position, DEV_TUNING.rideFootprint, this.world)) {
      return '该落点尚未核验或无法容纳角色，已保留当前位置。';
    }
    this.keys.clear();
    this.state = { ...this.state, position: { ...safe.position }, mode: 'walk', moving: false };
    this.character?.update(this.state, 0);
    this.publishStatus(true);
    this.fitToWindow();
    return null;
  }

  /** 可通行区域叠加层（调试显示，默认隐藏）。 */
  private buildOverlay() {
    const grid = this.world.raster;
    if (!grid) return;
    const canvas = document.createElement('canvas');
    canvas.width = grid.width;
    canvas.height = grid.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(grid.width, grid.height);
    for (let i = 0; i < grid.grid.length; i++) {
      const o = i * 4;
      if (grid.grid[i]) { img.data[o] = 40; img.data[o + 1] = 200; img.data[o + 2] = 90; img.data[o + 3] = 110; }
      else { img.data[o] = 220; img.data[o + 1] = 40; img.data[o + 2] = 40; img.data[o + 3] = 70; }
    }
    ctx.putImageData(img, 0, 0);
    if (this.textures.exists('walkable-overlay')) this.textures.remove('walkable-overlay');
    this.textures.addCanvas('walkable-overlay', canvas);
    this.overlay = this.add.image(0, 0, 'walkable-overlay').setOrigin(0).setDepth(-999_999).setVisible(false);
  }

  /** 显示/隐藏可通行区域叠加层。 */
  setOverlayVisible(value: boolean) {
    this.overlay?.setVisible(value);
  }

  get hasOverlay() {
    return this.overlay !== null;
  }

  get hasCharacter() {
    return this.character !== null;
  }

  /** 新按 WASD 可结束自由浏览；显式定位恢复默认缩放，键盘恢复保留当前缩放。 */
  setViewMode(mode: ViewMode, resetZoom = true) {
    if (mode === 'browse' && this.southGatePolice?.isBlocking) return;
    if (!this.ready || (mode === 'character' && (!this.character || !this.movementAvailable))) return;
    this.viewMode = mode;
    this.callbacks.onViewModeChange?.(mode);
    const camera = this.cameras.main;
    this.syncKeySuspension();
    if (mode === 'character') {
      this.character!.image.setVisible(true);
      // 显式点击定位仍恢复默认镜头；地点返回只适配视口，不重置用户倍率。
      this.characterZoom = resetZoom ? CHARACTER_ZOOM : camera.zoom;
      this.fitToWindow();
      camera.startFollow(this.character!.image, true);
      this.publishStatus(true);
    } else {
      camera.stopFollow();
      // 拖动时保留角色与镜头倍率，定位按钮可恢复跟随。
      this.character?.image.setVisible(true);
    }
  }

  /** 功能页、表单等打开时暂停角色并清键。 */
  setSuspended(value: boolean) {
    this.suspended = value;
    this.syncKeySuspension();
  }

  fitToWindow() {
    if (!this.ready) return;
    const camera = this.cameras.main;
    this.minimumZoom = Math.max(camera.width / this.mapWidth, camera.height / this.mapHeight);
    if (this.viewMode === 'character') {
      camera.setZoom(Math.max(this.characterZoom, this.minimumZoom));
      this.updateCameraBounds();
      camera.centerOn(this.state.position.x, this.state.position.y);
    } else {
      camera.setZoom(this.minimumZoom);
      this.updateCameraBounds();
      camera.centerOn(this.mapWidth / 2, this.mapHeight / 2);
    }
    this.callbacks.onZoom(camera.zoom);
  }

  changeZoom(factor: number) {
    if (!this.ready) return;
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * factor, this.minimumZoom, MAX_ZOOM));
    if (this.viewMode === 'character') this.characterZoom = camera.zoom;
    this.updateCameraBounds();
    this.callbacks.onZoom(camera.zoom);
  }

  private syncKeySuspension() {
    this.keys.setSuspended(this.suspended || this.viewMode !== 'character' || !!this.southGatePolice?.isBlocking);
    if (this.suspended || this.viewMode !== 'character') this.southGatePolice?.hide();
    this.updateTarget();
  }

  private publishStatus(force = false) {
    const status: CharacterStatus = {
      x: Math.round(this.state.position.x * 10) / 10,
      y: Math.round(this.state.position.y * 10) / 10,
      facing: this.state.facing,
      mode: this.state.mode,
      moving: this.state.moving,
    };
    const key = JSON.stringify(status);
    if (!force && key === this.lastStatus) return;
    this.lastStatus = key;
    this.callbacks.onCharacterStatus?.(status);
  }

  private updateCameraBounds() {
    const camera = this.cameras.main;
    // 地图小于视口时，两侧留出相等空白，使地图居中。
    const marginX = Math.max(0, (camera.width / camera.zoom - this.mapWidth) / 2);
    const marginY = Math.max(0, (camera.height / camera.zoom - this.mapHeight) / 2);
    camera.setBounds(-marginX, -marginY, this.mapWidth + 2 * marginX, this.mapHeight + 2 * marginY);
  }
}
