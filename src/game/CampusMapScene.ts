import * as Phaser from 'phaser';

type MapCallbacks = {
  onReady: () => void;
  onError: () => void;
  onZoom: (zoom: number) => void;
};

export class CampusMapScene extends Phaser.Scene {
  private mapWidth = 0;
  private mapHeight = 0;
  private minimumZoom = 1;
  private ready = false;

  constructor(private readonly callbacks: MapCallbacks) {
    super('campus-map-preview');
  }

  preload() {
    this.load.once('loaderror', () => this.callbacks.onError());
    this.load.image('campus', '/maps/campus-final-v9.png');
  }

  create() {
    if (!this.textures.exists('campus')) return;
    const source = this.textures.get('campus').getSourceImage();
    this.mapWidth = source.width;
    this.mapHeight = source.height;
    this.add.image(0, 0, 'campus').setOrigin(0);
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.ready = true;
    this.fitToWindow();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
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

    this.scale.on('resize', this.fitToWindow, this);
    this.events.once('shutdown', () => {
      this.ready = false;
      this.scale.off('resize', this.fitToWindow, this);
    });
    this.callbacks.onReady();
  }

  fitToWindow() {
    if (!this.ready) return;
    const camera = this.cameras.main;
    this.minimumZoom = Math.min(
      camera.width / this.mapWidth,
      camera.height / this.mapHeight,
      1,
    );
    camera.setZoom(this.minimumZoom);
    this.updateCameraBounds();
    camera.centerOn(this.mapWidth / 2, this.mapHeight / 2);
    this.callbacks.onZoom(camera.zoom);
  }

  changeZoom(factor: number) {
    if (!this.ready) return;
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * factor, this.minimumZoom, 3));
    this.updateCameraBounds();
    this.callbacks.onZoom(camera.zoom);
  }

  private updateCameraBounds() {
    const camera = this.cameras.main;
    // When the map fits inside the viewport, allow equal margins on both sides.
    const marginX = Math.max(0, (camera.width / camera.zoom - this.mapWidth) / 2);
    const marginY = Math.max(0, (camera.height / camera.zoom - this.mapHeight) / 2);
    camera.setBounds(-marginX, -marginY, this.mapWidth + 2 * marginX, this.mapHeight + 2 * marginY);
  }
}
