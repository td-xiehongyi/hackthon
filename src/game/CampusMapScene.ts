/**
 * 校园地图场景（v20 运行底图）。
 *
 * 提供两种镜头模式：
 * - **浏览**：拖动、滚轮/按钮缩放、适应窗口（原地图预览功能）。
 * - **角色**：放入角色，WASD 跑动、按住 Shift 骑行，镜头跟随。
 *
 * 通行范围来自 public/maps/campus-v20.annotations.json：由 tools/map 从底图颜色自动提取，
 * 状态为 pending（待用户核对）。角色只能在道路、步道、广场和桥面上移动。
 * 标注加载失败或与底图哈希不符时，退回**临时自由移动**（只限图片范围），并在界面上明确提示。
 * 出生点尚未确认（D-04）：暂取地图中心附近第一个可站立的位置。
 */

import * as Phaser from 'phaser';
import {
  MAP_HEIGHT_PX,
  MAP_ID,
  MAP_IMAGE_PATH,
  MAP_IMAGE_SHA256,
  MAP_WIDTH_PX,
  type MapAnnotation,
  type Point,
} from '@/shared/contracts';
import { CharacterSprite, preloadCharacter } from './character/character-sprite';
import { bindMovementKeys, MovementKeys } from './input/movement-keys';
import {
  DEV_TUNING,
  nearestStandable,
  rasterizeWorld,
  step,
  type CharacterState,
  type WalkableWorld,
} from './movement/movement';
import { rectToPolygon } from './movement/geometry';

export type ViewMode = 'browse' | 'character';

/** 通行范围来源：正式标注（自动提取、待核验）或标注不可用时的自由移动。 */
export type CollisionSource = 'annotation' | 'free-roam';

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
};

/**
 * 临时自由移动世界：整张图片为行走区、无碰撞。
 * 仅用于在标定前让角色能在正式底图上跑动，**不是通行标注**。
 */
export const UNCALIBRATED_FREE_ROAM: WalkableWorld = {
  walkableAreas: [{ id: 'uncalibrated-image-bounds', polygon: rectToPolygon({ x: 0, y: 0, width: MAP_WIDTH_PX, height: MAP_HEIGHT_PX }) }],
  collisionAreas: [],
};

/** 未标定出生点前的临时起点：地图中心。 */
export const UNCALIBRATED_START: Point = { x: Math.round(MAP_WIDTH_PX / 2), y: Math.round(MAP_HEIGHT_PX / 2) };

/** 角色模式下的镜头倍率（开发调试值，不是已确认的地图显示比例）。 */
const CHARACTER_ZOOM = 3;
const MAX_ZOOM = 6;

export class CampusMapScene extends Phaser.Scene {
  private mapWidth = 0;
  private mapHeight = 0;
  private minimumZoom = 1;
  private ready = false;
  private viewMode: ViewMode = 'browse';
  private suspended = false;
  readonly keys = new MovementKeys();
  private unbindKeys: (() => void) | null = null;
  private character: CharacterSprite | null = null;
  private state: CharacterState = { position: { ...UNCALIBRATED_START }, facing: 'down', mode: 'walk', moving: false };
  private lastStatus = '';
  private world: WalkableWorld = UNCALIBRATED_FREE_ROAM;
  private overlay: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly callbacks: MapCallbacks,
    /** 加载完成后默认进入的模式：默认直接放出角色。 */
    private readonly initialMode: ViewMode = 'character',
  ) {
    super('campus-map');
  }

  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === 'campus') this.callbacks.onError();
      else if (file.key !== 'annotation') this.callbacks.onCharacterError?.('角色素材加载失败');
    });
    this.load.image('campus', MAP_IMAGE_PATH);
    this.load.json('annotation', ANNOTATION_PATH);
    preloadCharacter(this);
  }

  create() {
    if (!this.textures.exists('campus')) return;
    const source = this.textures.get('campus').getSourceImage();
    this.mapWidth = source.width;
    this.mapHeight = source.height;
    this.add.image(0, 0, 'campus').setOrigin(0).setDepth(-1_000_000);
    this.cameras.main.setRoundPixels(true);
    this.ready = true;
    this.setupWorld();

    const created = CharacterSprite.create(this);
    if ('error' in created) {
      this.callbacks.onCharacterError?.(created.error);
    } else {
      this.character = created;
      this.character.update(this.state, 0);
      this.character.image.setVisible(false);
    }

    this.fitToWindow();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.viewMode !== 'browse') return;
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

    this.unbindKeys = bindMovementKeys(this.keys);
    this.syncKeySuspension();

    this.scale.on('resize', this.fitToWindow, this);
    this.events.once('shutdown', () => {
      this.ready = false;
      this.unbindKeys?.();
      this.scale.off('resize', this.fitToWindow, this);
    });
    this.callbacks.onReady();
    if (this.initialMode === 'character' && this.character) this.setViewMode('character');
    else this.callbacks.onViewModeChange?.('browse');
  }

  update(_time: number, deltaMs: number) {
    if (!this.character || this.viewMode !== 'character') return;
    this.state = step(this.state, this.keys.snapshot(), deltaMs / 1000, this.world, DEV_TUNING);
    this.character.update(this.state, deltaMs);
    this.publishStatus();
  }

  /** 读取并校验标注；不可用时退回自由移动并说明原因。 */
  private setupWorld() {
    const annotation = this.cache.json.get('annotation') as MapAnnotation | undefined;
    let reason = '';
    if (!annotation) reason = '通行标注文件未能加载';
    else if (annotation.mapId !== MAP_ID || annotation.imageSha256 !== MAP_IMAGE_SHA256) reason = '通行标注与当前底图不匹配';
    else if (annotation.walkableAreas.length === 0) reason = '通行标注中没有行走区';
    if (reason) {
      this.world = UNCALIBRATED_FREE_ROAM;
      this.callbacks.onCollisionSource?.('free-roam', reason);
    } else {
      this.world = rasterizeWorld(
        { walkableAreas: annotation!.walkableAreas, collisionAreas: annotation!.collisionAreas },
        this.mapWidth,
        this.mapHeight,
      );
      this.callbacks.onCollisionSource?.(
        'annotation',
        annotation!.annotationStatus === 'verified' ? '已核验' : '自动提取，待核验',
      );
      this.buildOverlay();
    }
    const start = nearestStandable(UNCALIBRATED_START, DEV_TUNING.rideFootprint, this.world);
    if (start) this.state = { ...this.state, position: start };
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

  /** 切换浏览/角色模式。浏览模式下移动键不驱动角色。 */
  setViewMode(mode: ViewMode) {
    if (!this.ready || (mode === 'character' && !this.character)) return;
    this.viewMode = mode;
    this.callbacks.onViewModeChange?.(mode);
    const camera = this.cameras.main;
    this.syncKeySuspension();
    if (mode === 'character') {
      this.character!.image.setVisible(true);
      this.fitToWindow();
      camera.startFollow(this.character!.image, true);
      this.publishStatus(true);
    } else {
      camera.stopFollow();
      this.character?.image.setVisible(false);
      this.fitToWindow();
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
    this.minimumZoom = Math.min(camera.width / this.mapWidth, camera.height / this.mapHeight, 1);
    if (this.viewMode === 'character') {
      camera.setZoom(Math.max(CHARACTER_ZOOM, this.minimumZoom));
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
    this.updateCameraBounds();
    this.callbacks.onZoom(camera.zoom);
  }

  private syncKeySuspension() {
    this.keys.setSuspended(this.suspended || this.viewMode !== 'character');
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
