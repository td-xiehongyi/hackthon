import * as Phaser from 'phaser';
import type { CharacterState } from './movement/movement';
import { acknowledgeHelmetReminder, initialHelmetReminder, SOUTH_GATE_POLICE, stepHelmetReminder } from './south-gate-reminder';
import './south-gate-police.css';
import { playPoliceWarning } from '../shared/police-warning-audio';

/** 警察沿用场景的脚底深度排序；文字气泡跟随警察的屏幕位置。 */
export class SouthGatePolice {
  private reminder = initialHelmetReminder();
  private readonly bubble = document.createElement('button');
  private stopWarningAudio: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene, onRelease: () => void) {
    const config = SOUTH_GATE_POLICE;
    const source = scene.textures.get(config.texture).getSourceImage();
    scene.add.image(config.x, config.y, config.texture).setOrigin(0.5, 1)
      .setDisplaySize(config.height * source.width / source.height, config.height).setDepth(config.y);
    this.bubble.className = 'south-gate-police-bubble';
    this.bubble.type = 'button';
    this.bubble.title = '点击对话框后放行';
    this.bubble.setAttribute('aria-live', 'assertive');
    this.bubble.hidden = true;
    this.bubble.addEventListener('pointerdown', event => event.stopPropagation());
    this.bubble.addEventListener('click', event => {
      event.stopPropagation();
      if (!this.isBlocking) return;
      this.reminder = acknowledgeHelmetReminder(this.reminder);
      this.hide();
      onRelease();
      scene.game.canvas.focus({ preventScroll: true });
    });
    scene.game.canvas.parentElement?.append(this.bubble);
    scene.events.on(Phaser.Scenes.Events.RENDER, this.placeBubble, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hide();
      scene.events.off(Phaser.Scenes.Events.RENDER, this.placeBubble, this);
      this.bubble.remove();
    });
  }

  get isBlocking() { return this.reminder.awaitingAcknowledgement; }

  update(character: CharacterState, active: boolean) {
    this.reminder = stepHelmetReminder(this.reminder, character, active);
    const visible = active && this.isBlocking;
    const wasHidden = this.bubble.hidden;
    this.bubble.hidden = !visible;
    const text = visible ? SOUTH_GATE_POLICE.message : '';
    if (this.bubble.textContent !== text) this.bubble.textContent = text;
    if (visible && wasHidden) {
      this.stopWarningAudio = playPoliceWarning();
      this.placeBubble();
      this.bubble.focus({ preventScroll: true });
    }
    if (!visible && !wasHidden) this.hide();
  }

  hide() {
    this.stopWarningAudio?.();
    this.stopWarningAudio = null;
    this.bubble.hidden = true;
    this.bubble.textContent = '';
  }

  private placeBubble() {
    if (this.bubble.hidden) return;
    const camera = this.scene.cameras.main;
    const canvas = this.scene.game.canvas;
    const scaleX = canvas.clientWidth / this.scene.scale.width;
    const scaleY = canvas.clientHeight / this.scene.scale.height;
    const x = (SOUTH_GATE_POLICE.x - camera.worldView.x) * camera.zoom * scaleX;
    const y = (SOUTH_GATE_POLICE.y - SOUTH_GATE_POLICE.height - 3 - camera.worldView.y) * camera.zoom * scaleY;
    const halfWidth = this.bubble.offsetWidth / 2;
    this.bubble.style.left = `${Math.max(halfWidth + 12, Math.min(canvas.clientWidth - halfWidth - 12, x))}px`;
    this.bubble.style.top = `${Math.max(this.bubble.offsetHeight + 12, Math.min(canvas.clientHeight - 12, y))}px`;
  }
}
