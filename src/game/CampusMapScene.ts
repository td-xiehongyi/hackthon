import * as Phaser from 'phaser';

type MapCallbacks = {
  onReady: () => void;
  onError: () => void;
  onZoom: (zoom: number) => void;
  onOpenTeaching: () => void;
  onOpenDormitory?: () => void;
  onTeachingProximity: (near: boolean) => void;
};

export class CampusMapScene extends Phaser.Scene {
  private mapWidth = 0;
  private mapHeight = 0;
  private minimumZoom = 1;
  private ready = false;
  private player!: Phaser.GameObjects.Container;
  private playerPosition = new Phaser.Math.Vector2(380, 1270);
  private teachingPoint = new Phaser.Math.Vector2(506, 1267);
  // 地图上的升华公寓文字位于麓南校区中部；该坐标仅作发现入口，待正式标注后再校核。
  private dormitoryPoint = new Phaser.Math.Vector2(360, 615);
  private proximityTriggered = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

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
    this.createTeachingHotspot();
    this.createDormitoryHotspot();
    this.createPlayer();
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
    this.cursors = this.input.keyboard?.createCursorKeys() as Phaser.Types.Input.Keyboard.CursorKeys;
    this.keys = this.input.keyboard?.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as typeof this.keys;
    this.events.on('update', this.updatePlayer, this);

    this.scale.on('resize', this.fitToWindow, this);
    this.events.once('shutdown', () => {
      this.ready = false;
      this.events.off('update', this.updatePlayer, this);
      this.scale.off('resize', this.fitToWindow, this);
    });
    this.callbacks.onReady();
  }

  private createPlayer() {
    const shadow = this.add.ellipse(0, 13, 28, 10, 0x102e27, 0.35);
    const body = this.add.circle(0, 0, 13, 0xf1c85b, 1).setStrokeStyle(3, 0x173f35, 1);
    const face = this.add.circle(0, -2, 7, 0xfff4d2, 1);
    const playerLabel = this.add.text(0, -34, '你', {
      color: '#173f35',
      backgroundColor: '#fffbea',
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5);
    this.player = this.add.container(this.playerPosition.x, this.playerPosition.y, [shadow, body, face, playerLabel]);
    this.player.setDepth(20);
  }

  private updatePlayer(_time: number, delta: number) {
    if (!this.ready || !this.player || !this.cursors || !this.keys) return;
    const direction = new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.keys.right.isDown) - Number(this.cursors.left.isDown || this.keys.left.isDown),
      Number(this.cursors.down.isDown || this.keys.down.isDown) - Number(this.cursors.up.isDown || this.keys.up.isDown),
    );
    if (direction.lengthSq() > 0) {
      direction.normalize().scale(Math.min(0.35 * delta, 7));
      this.playerPosition.x = Phaser.Math.Clamp(this.playerPosition.x + direction.x, 30, this.mapWidth - 30);
      this.playerPosition.y = Phaser.Math.Clamp(this.playerPosition.y + direction.y, 30, this.mapHeight - 30);
      this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
    }
    const near = Phaser.Math.Distance.BetweenPoints(this.playerPosition, this.teachingPoint) <= 82;
    this.callbacks.onTeachingProximity(near);
    if (near && !this.proximityTriggered) {
      this.proximityTriggered = true;
      this.callbacks.onOpenTeaching();
    } else if (!near) {
      this.proximityTriggered = false;
    }
  }

  private createTeachingHotspot() {
    // Source-image coordinates for the labelled teaching group on the current map.
    // This is a discoverability hotspot, not a verified character entrance/return point.
    const halo = this.add.circle(0, 0, 44, 0xf5cf65, 0.32)
      .setStrokeStyle(3, 0xfff4b8, 0.92);
    const marker = this.add.circle(0, 0, 27, 0x173f35, 1)
      .setStrokeStyle(3, 0xfdf9dd, 1);
    const glyph = this.add.text(0, -1, '课', {
      color: '#fffbea',
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, -59, '课表 · 蹭课', {
      backgroundColor: '#fffbea',
      color: '#173f35',
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      padding: { x: 9, y: 6 },
    }).setOrigin(0.5).setStroke('#173f35', 1);

    const hotspot = this.add.container(this.teachingPoint.x, this.teachingPoint.y, [halo, marker, glyph, label]);
    hotspot.setSize(152, 126).setInteractive({ useHandCursor: true });
    hotspot.on('pointerover', () => {
      halo.setScale(1.14);
      label.setBackgroundColor('#f5cf65');
    });
    hotspot.on('pointerout', () => {
      halo.setScale(1);
      label.setBackgroundColor('#fffbea');
    });
    hotspot.on('pointerup', () => this.callbacks.onOpenTeaching());

  }

  private createDormitoryHotspot() {
    const halo = this.add.circle(0, 0, 39, 0xe2b958, 0.28)
      .setStrokeStyle(3, 0xffefb0, 0.9);
    const marker = this.add.circle(0, 0, 25, 0x8b6324, 1)
      .setStrokeStyle(3, 0xfff8dc, 1);
    const glyph = this.add.text(0, -1, '宿', {
      color: '#fffbea',
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const label = this.add.text(0, -54, '升华公寓 · 群聊', {
      backgroundColor: '#fffbea',
      color: '#6d501e',
      fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      padding: { x: 8, y: 5 },
    }).setOrigin(0.5).setStroke('#6d501e', 1);
    const hotspot = this.add.container(this.dormitoryPoint.x, this.dormitoryPoint.y, [halo, marker, glyph, label]);
    hotspot.setSize(166, 118).setInteractive({ useHandCursor: true });
    hotspot.on('pointerover', () => {
      halo.setScale(1.14);
      label.setBackgroundColor('#f5cf65');
    });
    hotspot.on('pointerout', () => {
      halo.setScale(1);
      label.setBackgroundColor('#fffbea');
    });
    hotspot.on('pointerup', () => this.callbacks.onOpenDormitory?.());
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
