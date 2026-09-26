// Character Playground — playback logic.
//
// This module knows how to READ sprite-sheet metadata and drive a <canvas>
// from it. It has zero knowledge of what the character looks like, how many
// pixels it is, or what colors it uses — all of that lives in
// assets/character-meta.js + assets/character-sheet.png. Swapping in a
// different character later means replacing those two asset files; this
// file should not need to change.
//
// Usage:
//   const player = createCharacterPlayer(canvas, meta, sheetImage);
//   player.setState('walk');
//   player.setDirection('down');
//   player.start();

/**
 * @param {HTMLCanvasElement} canvas - target canvas to draw into (its
 *        width/height define the on-screen scale; the source frame is
 *        drawn stretched to fill it, with pixelated scaling assumed to be
 *        set via CSS `image-rendering: pixelated` on the canvas element).
 * @param {object} meta - parsed character-meta contents (frameWidth,
 *        frameHeight, animations: { [state]: { frameCount, frameDurationMs,
 *        directions: { [direction]: {x, y} } } }).
 * @param {HTMLImageElement} sheetImage - the loaded sprite sheet image.
 */
function createCharacterPlayer(canvas, meta, sheetImage) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let state = meta.states[0];
  let direction = meta.directions[0];
  let frameIndex = 0;
  let elapsed = 0;
  let lastTime = performance.now();
  let running = false;
  let rafHandle = null;

  function currentAnim() {
    return meta.animations[state];
  }

  function frameDuration(anim, index) {
    const d = anim.frameDurationMs;
    return Array.isArray(d) ? d[index] : d;
  }

  function drawCurrentFrame() {
    const anim = currentAnim();
    const dirEntry = anim.directions[direction];
    const sx = dirEntry.x + frameIndex * meta.frameWidth;
    const sy = dirEntry.y;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      sheetImage,
      sx, sy, meta.frameWidth, meta.frameHeight,
      0, 0, canvas.width, canvas.height
    );
  }

  function tick() {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;

    const anim = currentAnim();
    elapsed += dt;
    const dur = frameDuration(anim, frameIndex);
    if (elapsed >= dur) {
      elapsed = 0;
      frameIndex = (frameIndex + 1) % anim.frameCount;
    }

    drawCurrentFrame();
    if (running) rafHandle = requestAnimationFrame(tick);
  }

  return {
    /** Switch animation state ('idle' | 'walk' | 'run'). Resets to frame 0. */
    setState(nextState) {
      if (!meta.animations[nextState]) {
        throw new Error(`Unknown state "${nextState}". Valid states: ${meta.states.join(', ')}`);
      }
      state = nextState;
      frameIndex = 0;
      elapsed = 0;
      drawCurrentFrame();
    },
    /** Switch facing direction (any of meta.directions). Resets to frame 0. */
    setDirection(nextDirection) {
      if (!meta.directions.includes(nextDirection)) {
        throw new Error(`Unknown direction "${nextDirection}". Valid directions: ${meta.directions.join(', ')}`);
      }
      direction = nextDirection;
      frameIndex = 0;
      elapsed = 0;
      drawCurrentFrame();
    },
    getState() { return state; },
    getDirection() { return direction; },
    /** Start the animation loop (idempotent — calling twice is harmless). */
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafHandle = requestAnimationFrame(tick);
    },
    /** Stop the animation loop and hold on the current frame. */
    stop() {
      running = false;
      if (rafHandle) cancelAnimationFrame(rafHandle);
    },
  };
}
