// Placeholder character + e-scooter sprite generator — E's own tooling.
//
// PURPOSE: produce a clearly-temporary, programmatically-drawn sprite set that
// satisfies the 16-state contract in docs/contracts/campus-v1.d.ts, so A can
// wire up WASD movement + Shift ride-toggle NOW instead of waiting on final
// character art. Per docs/01 §5 (P1) and docs/04 §6 (E1/E2), temporary
// labeled test assets are allowed to unblock A's loader/state-machine work;
// this output must NOT be treated as the final approved character design.
//
// This script only writes into E's own directories:
//   - public/characters/student/walk-sheet.png
//   - public/characters/student/ride-sheet.png
//   - public/characters/student/manifest.json
// It does not touch src/game, src/app, or any other contributor's files.
//
// Regenerate with: node assets/characters/source/generate-placeholder-sprites.js
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ============================================================================
// Minimal PNG encoder (RGBA, 8-bit, no external deps — uses Node's built-in zlib)
// ============================================================================

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** @param {number} width @param {number} height @param {Uint8ClampedArray} rgba length width*height*4 */
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  // Raw scanlines, each prefixed with filter type 0 (none)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============================================================================
// Tiny raster canvas helpers (flat-fill pixel art, no anti-aliasing)
// ============================================================================

function makeCanvas(w, h) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) }; // all zero = fully transparent
}

function setPx(cv, x, y, c) {
  if (x < 0 || y < 0 || x >= cv.w || y >= cv.h) return;
  const i = (y * cv.w + x) * 4;
  cv.data[i] = c[0];
  cv.data[i + 1] = c[1];
  cv.data[i + 2] = c[2];
  cv.data[i + 3] = c[3] === undefined ? 255 : c[3];
}

function fillRect(cv, x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(cv, x, y, c);
}

function fillCircle(cv, cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + 0.2) setPx(cv, cx + x, cy + y, c);
    }
  }
}

/** Copies src canvas into dest canvas at (dx, dy), alpha-overwrite (no blending needed for flat fills). */
function blit(dest, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.data[i + 3];
      if (a === 0) continue;
      setPx(dest, dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2], a]);
    }
  }
}

/** Horizontal mirror: used to derive "left" art from authored "right" art. */
function mirrorH(cv) {
  const out = makeCanvas(cv.w, cv.h);
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const si = (y * cv.w + x) * 4;
      const dx = cv.w - 1 - x;
      const di = (y * cv.w + dx) * 4;
      out.data[di] = cv.data[si];
      out.data[di + 1] = cv.data[si + 1];
      out.data[di + 2] = cv.data[si + 2];
      out.data[di + 3] = cv.data[si + 3];
    }
  }
  return out;
}

function mirrorAnchorH(ax, w) {
  return w - 1 - ax;
}

// ============================================================================
// Palette — arbitrary placeholder colors, NOT official CSU branding.
// Swap freely when real art replaces this.
// ============================================================================

const P = {
  skin: [237, 197, 158, 255],
  hair: [69, 51, 40, 255],
  hairShade: [48, 35, 27, 255],
  shirt: [58, 125, 150, 255],
  shirtShade: [42, 96, 117, 255],
  pants: [55, 68, 84, 255],
  pantsShade: [40, 50, 62, 255],
  shoe: [33, 30, 28, 255],
  backpack: [156, 76, 58, 255],
  outline: [26, 22, 20, 255],
  scooterBody: [196, 64, 52, 255],
  scooterBodyShade: [154, 46, 40, 255],
  scooterDeck: [96, 96, 100, 255],
  wheel: [35, 35, 38, 255],
  wheelHubA: [150, 150, 156, 255],
  wheelHubB: [90, 90, 96, 255],
  headlight: [255, 219, 120, 255],
  taillight: [214, 48, 42, 255],
  handlebar: [70, 70, 76, 255],
  eye: [45, 34, 30, 255],
  mouth: [156, 74, 68, 255],
  hairHighlight: [107, 82, 63, 255],
};

// ============================================================================
// Walk frames — canvas 32x48. Directions authored: down, up, right. left = mirror(right).
// Ground anchor (feet-center) is a FIXED reference line per (direction); it does
// not track the bob/stagger of the legs, so the world position stays stable
// across idle/move frames (see docs/04 §5).
// ============================================================================

const WALK_W = 32;
const WALK_H = 48;
const WALK_ANCHOR = { down: [16, 47], up: [16, 47], right: [17, 47] };

function buildWalkFrame(direction, pose) {
  const cv = makeCanvas(WALK_W, WALK_H);
  const bob = pose === 'idle' ? 0 : 1;
  // Shared walk-cycle leg technique for both views below: hip x-positions
  // are fixed (never slid sideways), and each leg independently shortens
  // (foot lifts off the ground) on its own "step" frame while the other
  // stays fully planted. Earlier drafts shifted both legs left/right by a
  // `stagger` offset instead, which either placed them at the exact same
  // spot (idle: fully overlapping, reads as one leg) or overlapped them by
  // 3px at the animated frames (move0/move1: the two legs merge into one
  // blob). Lifting instead of sliding keeps the two legs always distinct.
  const FULL_LEG = 14;
  const LIFT = 3;

  if (direction === 'right') {
    // Side profile: head offset toward the facing side, single visible arm/leg lean.
    fillCircle(cv, 19, 10 + bob, 5, P.hair);
    fillRect(cv, 16, 7 + bob, 4, 2, P.hairHighlight); // hair-top highlight, breaks up the flat fill
    fillCircle(cv, 19, 12 + bob, 4, P.skin);
    fillRect(cv, 20, 9 + bob, 2, 2, P.skin); // nose bump toward facing direction
    // Cute-style 3/4 face: both eyes visible even in profile (near eye
    // slightly forward/lower, far eye slightly back/higher), instead of a
    // strict single-eye side view.
    setPx(cv, 21, 10 + bob, P.eye); // near eye
    setPx(cv, 18, 9 + bob, P.eye); // far eye
    fillRect(cv, 19, 13 + bob, 2, 1, P.mouth);
    fillRect(cv, 13, 16 + bob, 11, 14, P.shirt);
    fillRect(cv, 13, 16 + bob, 11, 3, P.shirtShade);
    fillRect(cv, 12, 18 + bob, 3, 8, P.skin); // trailing arm
    // Back leg (13..18, shaded) and front leg (18..23, lit) sit side by side
    // with no horizontal overlap at any pose.
    const backLift = pose === 'move1' ? LIFT : 0;
    const frontLift = pose === 'move0' ? LIFT : 0;
    const hipY = 30 + bob;
    const backLegH = FULL_LEG - backLift;
    const frontLegH = FULL_LEG - frontLift;
    fillRect(cv, 13, hipY, 5, backLegH, P.pantsShade);
    fillRect(cv, 13, hipY + backLegH - 3, 5, 3, P.shoe);
    fillRect(cv, 18, hipY, 5, frontLegH, P.pants);
    fillRect(cv, 18, hipY + frontLegH - 3, 5, 3, P.shoe);
    return cv;
  }

  // down / up share the same symmetric skeleton; only head + backpack differ.
  // Face only goes on the front (down) view — the back (up) view stays a
  // plain silhouette, which is the standard top-down-sprite convention
  // (there is no face to draw when looking at the back of someone's head).
  const isBack = direction === 'up';
  fillRect(cv, 11, 4 + bob, 10, 6, isBack ? P.hair : P.hairShade); // hair cap / back of head
  if (!isBack) fillRect(cv, 12, 5 + bob, 4, 2, P.hairHighlight); // hair-top highlight
  fillCircle(cv, 16, 10 + bob, 5, isBack ? P.hair : P.skin);
  if (!isBack) {
    setPx(cv, 14, 9 + bob, P.eye);
    setPx(cv, 18, 9 + bob, P.eye);
    fillRect(cv, 15, 12 + bob, 2, 1, P.mouth);
  }
  if (isBack) fillRect(cv, 13, 17 + bob, 6, 8, P.backpack);
  fillRect(cv, 9, 15 + bob, 14, 15, P.shirt);
  fillRect(cv, 9, 15 + bob, 14, 3, P.shirtShade);
  // Left leg (x=11) and right leg (x=17) sit side by side with a 1px gap;
  // neither ever moves sideways, so they can never overlap.
  const leftLift = pose === 'move0' ? LIFT : 0;
  const rightLift = pose === 'move1' ? LIFT : 0;
  const hipY = 30 + bob;
  const leftLegH = FULL_LEG - leftLift;
  const rightLegH = FULL_LEG - rightLift;
  fillRect(cv, 11, hipY, 5, leftLegH, P.pants);
  fillRect(cv, 17, hipY, 5, rightLegH, P.pants);
  fillRect(cv, 11, hipY + leftLegH - 3, 5, 3, P.shoe);
  fillRect(cv, 17, hipY + rightLegH - 3, 5, 3, P.shoe);
  return cv;
}

// ============================================================================
// Ride frames (person + scooter combined, per contract §1). Canvas 56x56.
// Directions authored: down, up, right. left = mirror(right).
// down/up are each drawn upright (NOT a vertical flip of one another — flipping
// a vehicle upside down to change facing would put the wheels on top).
// ============================================================================

const RIDE_W = 56;
const RIDE_H = 56;
const RIDE_ANCHOR = { down: [28, 51], up: [28, 51], right: [28, 47] };

function drawWheel(cv, cx, cy, r, hubToggle) {
  fillCircle(cv, cx, cy, r, P.wheel);
  fillCircle(cv, cx, cy, Math.max(1, r - 3), hubToggle ? P.wheelHubA : P.wheelHubB);
}

function buildRideFrame(direction, pose) {
  const cv = makeCanvas(RIDE_W, RIDE_H);
  const hubToggle = pose === 'move1';
  const bob = pose === 'idle' ? 0 : pose === 'move0' ? -1 : 1;

  if (direction === 'right') {
    // Horizontal layout: rear wheel left, front wheel right, rider leaning over handlebar.
    drawWheel(cv, 15, 42, 6, hubToggle);
    drawWheel(cv, 43, 42, 6, hubToggle);
    fillRect(cv, 15, 33, 29, 6, P.scooterBody);
    fillRect(cv, 15, 33, 29, 2, P.scooterBodyShade);
    fillRect(cv, 39, 20, 3, 14, P.scooterBodyShade); // steering column near front wheel
    fillRect(cv, 38, 18, 6, 3, P.scooterBody); // handlebar
    // rider standing on the deck, leaning slightly toward the handlebar
    fillCircle(cv, 33, 14 + bob, 5, P.hair);
    fillRect(cv, 30, 11 + bob, 4, 2, P.hairHighlight);
    fillCircle(cv, 33, 16 + bob, 4, P.skin);
    // Cute-style 3/4 face, same convention as the walk sprite's right-facing
    // head: both eyes visible even in profile.
    setPx(cv, 35, 15 + bob, P.eye); // near eye
    setPx(cv, 32, 14 + bob, P.eye); // far eye
    fillRect(cv, 33, 18 + bob, 2, 1, P.mouth);
    fillRect(cv, 28, 20 + bob, 11, 10, P.shirt);
    fillRect(cv, 30, 30 + bob, 7, 5, P.pants);
    return cv;
  }

  // down / up: front wheel + handlebar sit at the front of travel, rear
  // wheel trails behind. These are two separately-drawn poses, not a
  // vertical flip of one another (flipping would put the wheels on top).
  // Fix vs. the first pass: the frame/deck used to be as wide as the rider,
  // which hid both wheels almost completely and made the scooter
  // unrecognizable from the front/back. The frame is now deliberately
  // narrower than the wheels, the handlebar is deliberately wider than the
  // rider's shoulders, and a head/tail light marks which wheel is "front" —
  // together these make the vehicle read clearly from every angle.
  const isBack = direction === 'up';
  const frontY = isBack ? 14 : 44;
  const rearY = isBack ? 44 : 14;
  const frontR = 6;
  const rearR = 5;

  drawWheel(cv, 28, rearY, rearR, hubToggle);
  drawWheel(cv, 28, frontY, frontR, hubToggle);

  const frameTop = Math.min(frontY - frontR, rearY - rearR) + (isBack ? frontR : rearR) + 1;
  const frameBottom = Math.max(frontY + frontR, rearY + rearR) - (isBack ? rearR : frontR) - 1;
  fillRect(cv, 26, frameTop, 4, frameBottom - frameTop, P.scooterBody);
  fillRect(cv, 21, 27, 14, 3, P.scooterDeck); // footrest, clear of both wheels

  // Handlebar: clearly wider than the rider's shoulders, planted at the
  // front wheel — this silhouette is what reads as "scooter" head-on.
  const barY = isBack ? frontY + frontR + 1 : frontY - frontR - 3;
  fillRect(cv, 17, barY, 22, 3, P.handlebar);

  // Head/tail lights so facing direction stays legible at a glance.
  const headlightY = frontY + (isBack ? -frontR + 1 : frontR - 1);
  const taillightY = rearY + (isBack ? rearR - 1 : -rearR + 1);
  fillRect(cv, 28, headlightY, 2, 1, P.headlight);
  fillRect(cv, 28, taillightY, 2, 1, P.taillight);

  // Rider stands behind the handlebar, between the two wheels. Face only on
  // the front (down) view, matching the walk sprite's front/back convention.
  const headY = isBack ? 30 : 20;
  fillRect(cv, 20, headY - 4 + bob, 16, 7, isBack ? P.hair : P.hairShade); // hair cap / back of head band
  if (!isBack) fillRect(cv, 22, headY - 3 + bob, 5, 2, P.hairHighlight);
  fillCircle(cv, 28, headY + bob, 6, isBack ? P.hair : P.skin);
  if (!isBack) {
    setPx(cv, 25, headY - 1 + bob, P.eye);
    setPx(cv, 31, headY - 1 + bob, P.eye);
    fillRect(cv, 26, headY + 2 + bob, 3, 1, P.mouth);
  }
  if (isBack) fillRect(cv, 24, headY + 8 + bob, 8, 5, P.backpack);
  fillRect(cv, 21, headY + 5 + bob, 14, 9, P.shirt);
  fillRect(cv, 21, headY + 5 + bob, 14, 3, P.shirtShade);
  return cv;
}

// ============================================================================
// Assemble sheets: grid layout rows=[down,up,right,left], cols=[idle,move0,move1]
// ============================================================================

const DIRECTIONS = ['down', 'up', 'right', 'left'];
const POSES = ['idle', 'move0', 'move1'];
const DURATION_MS = { idle: 1000, move0: 220, move1: 220 };

function buildDirectionSet(builder, authoredAnchors, frameW) {
  /** @type {Record<string, Record<string, {cv: any}>>} */
  const out = { down: {}, up: {}, right: {}, left: {} };
  const anchors = { down: authoredAnchors.down, up: authoredAnchors.up, right: authoredAnchors.right };
  for (const pose of POSES) {
    out.down[pose] = builder('down', pose);
    out.up[pose] = builder('up', pose);
    const rightCv = builder('right', pose);
    out.right[pose] = rightCv;
    out.left[pose] = mirrorH(rightCv);
  }
  anchors.left = [mirrorAnchorH(authoredAnchors.right[0], frameW), authoredAnchors.right[1]];
  return { frames: out, anchors };
}

function buildSheet(frameW, frameH, directionSet) {
  const cols = POSES.length;
  const rows = DIRECTIONS.length;
  const sheet = makeCanvas(frameW * cols, frameH * rows);
  const rects = {};
  DIRECTIONS.forEach((dir, row) => {
    rects[dir] = {};
    POSES.forEach((pose, col) => {
      const x = col * frameW;
      const y = row * frameH;
      blit(sheet, directionSet.frames[dir][pose], x, y);
      rects[dir][pose] = { x, y, width: frameW, height: frameH };
    });
  });
  return { sheet, rects };
}

function buildClips(mode, rects, anchors) {
  const clips = [];
  for (const facing of DIRECTIONS) {
    const anchor = { x: anchors[facing][0], y: anchors[facing][1] };
    clips.push({
      mode,
      facing,
      action: 'idle',
      loop: true,
      frames: [
        {
          sheetId: mode,
          rect: rects[facing].idle,
          anchor,
          durationMs: DURATION_MS.idle,
        },
      ],
    });
    clips.push({
      mode,
      facing,
      action: 'move',
      loop: true,
      frames: [
        { sheetId: mode, rect: rects[facing].move0, anchor, durationMs: DURATION_MS.move0 },
        { sheetId: mode, rect: rects[facing].move1, anchor, durationMs: DURATION_MS.move1 },
      ],
    });
  }
  return clips;
}

// ============================================================================
// Build + write output
// ============================================================================

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'public', 'characters', 'student');

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const walkSet = buildDirectionSet(buildWalkFrame, WALK_ANCHOR, WALK_W);
  const { sheet: walkSheet, rects: walkRects } = buildSheet(WALK_W, WALK_H, walkSet);

  const rideSet = buildDirectionSet(buildRideFrame, RIDE_ANCHOR, RIDE_W);
  const { sheet: rideSheet, rects: rideRects } = buildSheet(RIDE_W, RIDE_H, rideSet);

  const walkPng = encodePNG(walkSheet.w, walkSheet.h, walkSheet.data);
  const ridePng = encodePNG(rideSheet.w, rideSheet.h, rideSheet.data);

  fs.writeFileSync(path.join(OUT_DIR, 'walk-sheet.png'), walkPng);
  fs.writeFileSync(path.join(OUT_DIR, 'ride-sheet.png'), ridePng);

  const manifest = {
    schemaVersion: 1,
    characterId: 'csu-campus-placeholder-v0',
    sheets: [
      { id: 'walk', url: 'walk-sheet.png', width: walkSheet.w, height: walkSheet.h },
      { id: 'ride', url: 'ride-sheet.png', width: rideSheet.w, height: rideSheet.h },
    ],
    clips: [...buildClips('walk', walkRects, walkSet.anchors), ...buildClips('ride', rideRects, rideSet.anchors)],
  };

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log('Wrote:');
  console.log(' -', path.join(OUT_DIR, 'walk-sheet.png'), `(${walkSheet.w}x${walkSheet.h})`);
  console.log(' -', path.join(OUT_DIR, 'ride-sheet.png'), `(${rideSheet.w}x${rideSheet.h})`);
  console.log(' -', path.join(OUT_DIR, 'manifest.json'), `(${manifest.clips.length} clips)`);
}

main();
