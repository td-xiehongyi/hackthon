// Build tool — NOT loaded by the playground at runtime.
//
// Regenerates the character's sprite sheet + metadata from the pose/shape
// definitions below. Run with: node tools/generate-sprites.js
//
// Output goes to ../assets/:
//   - character-sheet.png   the composited sprite sheet (all directions x states)
//   - character-meta.json   frame/animation lookup data (portable JSON form)
//   - character-meta.js     same data as `window.CHARACTER_META = {...}`,
//                            so the playground can load it via a plain
//                            <script src>, with no fetch()/server needed
//   - frames/<dir>/<state>_<i>.png   individual frames, for manual inspection only
//
// This file only produces DATA (images + metadata). It has no opinion about
// how that data is displayed — that's playground/character-player.js's job.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---------- Minimal PNG encoder (no external deps, uses built-in zlib) ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ---------- Tiny canvas ----------
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4); // transparent by default
  }
  setPixel(x, y, [r, g, b, a]) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    // simple alpha-over so overlapping fills (e.g. outline over body) blend cleanly
    const srcA = a / 255;
    if (srcA >= 1 || this.data[i + 3] === 0) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a;
    } else {
      const dstA = this.data[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      const mix = (s, d) => outA === 0 ? 0 : Math.round((s * srcA + d * dstA * (1 - srcA)) / outA);
      this.data[i] = mix(r, this.data[i]);
      this.data[i + 1] = mix(g, this.data[i + 1]);
      this.data[i + 2] = mix(b, this.data[i + 2]);
      this.data[i + 3] = Math.round(outA * 255);
    }
  }
  fillRect(x0, y0, x1, y1, color) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        this.setPixel(x, y, color);
  }
  // Filled ellipse using the standard implicit-equation test, rounded to a
  // pixel grid — the core primitive for a blobby, joint-less body.
  fillEllipse(cx, cy, rx, ry, color) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.setPixel(x, y, color);
      }
    }
  }
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3];
        if (a === 0) continue;
        this.setPixel(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2], a]);
      }
  }
  flipHorizontal() {
    const out = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const si = (y * this.w + (this.w - 1 - x)) * 4;
        const di = (y * this.w + x) * 4;
        out.data[di] = this.data[si]; out.data[di + 1] = this.data[si + 1];
        out.data[di + 2] = this.data[si + 2]; out.data[di + 3] = this.data[si + 3];
      }
    }
    return out;
  }
  toPNG() { return encodePNG(this.w, this.h, this.data); }
}

// ---------- PLACEHOLDER character design ----------
// This is a programmatically-drawn stand-in, not the team's final art. Its
// only job is to validate the animation/direction/state pipeline (see
// README.md for status). Colors/shape are an original design (round body,
// warm orange, pale belly, big eyes) — not a trace of any specific IP.
const COLORS = {
  body:      [247, 165, 40, 255],
  bodyShade: [222, 138, 25, 255],
  belly:     [255, 233, 190, 255],
  outline:   [120, 70, 20, 230],
  eye:       [35, 30, 25, 255],
  eyeShine:  [255, 255, 255, 235],
  mouth:     [150, 60, 30, 200],
  limb:      [235, 145, 30, 255],
  claw:      [200, 110, 20, 255],
};

const W = 20, H = 22;

// ---------- Pose parameters per state ----------
// A joint-less blob doesn't stride — it moves by deforming: squash-and-
// stretch plus a side-to-side weight sway. (Earlier limb-swing attempts for
// front/back views didn't read as walking at this pixel scale — see README.)
const STATE_CONFIG = {
  idle: { frames: 2, squashAmp: 0.06, swayAmp: 0, bounceAmp: 0.3, durationMs: [900, 900] },
  walk: { frames: 4, squashAmp: 0.14, swayAmp: 1.4, bounceAmp: 1.2, durationMs: [150, 150, 150, 150] },
  run:  { frames: 6, squashAmp: 0.26, swayAmp: 2.2, bounceAmp: 2.4, durationMs: [90, 90, 90, 90, 90, 90] },
};

function computePose(state, i) {
  const cfg = STATE_CONFIG[state];
  const angle = (i / cfg.frames) * Math.PI * 2;
  const squash = Math.sin(angle * 2) * cfg.squashAmp;
  const sway = Math.sin(angle) * cfg.swayAmp;
  const bounce = -Math.abs(Math.cos(angle)) * cfg.bounceAmp + cfg.bounceAmp * 0.5;
  return { squash, sway, bounce, state };
}

// ---------- Core body renderer, parameterized by which side faces the "camera" ----------
function drawBody(c, pose, facing) {
  const cx = W / 2;
  const baseCy = 11;
  const cy = baseCy + pose.bounce;
  const sx = pose.sway;
  const turn3q = facing === 'front3q' ? 1.6 : facing === 'back3q' ? -1.6 : 0;

  const squashX = 1 + pose.squash * 0.5;
  const squashY = 1 - pose.squash * 0.4;

  const armSwing = sx * 0.4;
  c.fillEllipse(cx + sx - 6.2 * squashX + armSwing, (cy - 1) * squashY + baseCy * (1 - squashY), 1.5, 2.4, COLORS.outline);
  c.fillEllipse(cx + sx - 6.2 * squashX + armSwing, (cy - 1) * squashY + baseCy * (1 - squashY), 1.1, 2, COLORS.limb);
  c.fillEllipse(cx + sx + 6.2 * squashX - armSwing, (cy - 1) * squashY + baseCy * (1 - squashY), 1.5, 2.4, COLORS.outline);
  c.fillEllipse(cx + sx + 6.2 * squashX - armSwing, (cy - 1) * squashY + baseCy * (1 - squashY), 1.1, 2, COLORS.limb);

  const footSpread = 2.2 + Math.max(0, pose.squash) * 2.5;
  const footY = cy + 8.5 * squashY;
  c.fillEllipse(cx + sx - footSpread, footY, 1.8, 1.3, COLORS.outline);
  c.fillEllipse(cx + sx + footSpread, footY, 1.8, 1.3, COLORS.outline);
  c.fillEllipse(cx + sx - footSpread, footY - 0.2, 1.4, 1, COLORS.claw);
  c.fillEllipse(cx + sx + footSpread, footY - 0.2, 1.4, 1, COLORS.claw);

  // Fused silhouette: head-zone + body-zone ellipses, same fill color, no
  // seam between them, so they read as one continuous shape.
  const headCx = cx + sx + turn3q;
  const headCy = cy - 5 * squashY;
  const headRx = 6.3 * squashX, headRy = 5.6 * squashY;
  const bodyCx = cx + sx + turn3q * 0.5;
  const bodyCy = cy + 2.5 * squashY;
  const bodyRx = 6.8 * squashX, bodyRy = 5.4 * squashY;

  c.fillEllipse(headCx, headCy, headRx + 0.7, headRy + 0.7, COLORS.outline);
  c.fillEllipse(bodyCx, bodyCy, bodyRx + 0.7, bodyRy + 0.7, COLORS.outline);
  c.fillEllipse(headCx, headCy, headRx, headRy, COLORS.body);
  c.fillEllipse(bodyCx, bodyCy, bodyRx, bodyRy, COLORS.body);

  const shadeSign = facing === 'back' || facing === 'back3q' ? -1 : 1;
  c.fillEllipse(bodyCx - shadeSign * bodyRx * 0.3, bodyCy + bodyRy * 0.35, bodyRx * 0.55, bodyRy * 0.45, COLORS.bodyShade);

  if (facing === 'front' || facing === 'front3q') {
    c.fillEllipse(bodyCx + (facing === 'front3q' ? turn3q * 0.3 : 0), bodyCy + 1.5, bodyRx * 0.55, bodyRy * 0.6, COLORS.belly);
  } else if (facing === 'side') {
    c.fillEllipse(bodyCx + 2, bodyCy + 1.5, bodyRx * 0.4, bodyRy * 0.55, COLORS.belly);
  }

  if (facing === 'front' || facing === 'front3q' || facing === 'side') {
    const eyeOffset = facing === 'side' ? 2.6 : facing === 'front3q' ? 1.8 : 0;
    const eyeSpread = facing === 'side' ? 0 : 3.1;
    const faceX = headCx + eyeOffset;
    const eyeY = headCy + 0.8;
    c.fillEllipse(faceX - eyeSpread, eyeY, 1.9, 2.3, COLORS.outline);
    c.fillEllipse(faceX + eyeSpread, eyeY, 1.9, 2.3, COLORS.outline);
    c.fillEllipse(faceX - eyeSpread, eyeY, 1.5, 1.9, COLORS.eye);
    c.fillEllipse(faceX + eyeSpread, eyeY, 1.5, 1.9, COLORS.eye);
    c.fillEllipse(faceX - eyeSpread - 0.5, eyeY - 0.7, 0.6, 0.6, COLORS.eyeShine);
    c.fillEllipse(faceX + eyeSpread - 0.5, eyeY - 0.7, 0.6, 0.6, COLORS.eyeShine);
    c.fillEllipse(faceX, eyeY + 2.6, 1.3, 1, COLORS.outline);
    c.fillEllipse(faceX, eyeY + 2.4, 1, 0.7, COLORS.mouth);
  }
}

const RENDERERS = {
  front:   (c, pose) => drawBody(c, pose, 'front'),
  back:    (c, pose) => drawBody(c, pose, 'back'),
  side:    (c, pose) => drawBody(c, pose, 'side'),
  front3q: (c, pose) => drawBody(c, pose, 'front3q'),
  back3q:  (c, pose) => drawBody(c, pose, 'back3q'),
};

// ---------- Build all directions/states ----------
const FACING_BY_DIR = {
  down: 'front', down_right: 'front3q', right: 'side', up_right: 'back3q', up: 'back',
};
const MIRROR_SOURCE = { down_left: 'down_right', left: 'right', up_left: 'up_right' };
const ALL_DIRECTIONS = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left'];
const STATES = ['idle', 'walk', 'run'];

const framesByKey = {}; // `${dir}_${state}` -> Canvas[]

for (const dir of Object.keys(FACING_BY_DIR)) {
  const facing = FACING_BY_DIR[dir];
  for (const state of STATES) {
    const cfg = STATE_CONFIG[state];
    const list = [];
    for (let i = 0; i < cfg.frames; i++) {
      const pose = computePose(state, i);
      const c = new Canvas(W, H);
      RENDERERS[facing](c, pose);
      list.push(c);
    }
    framesByKey[`${dir}_${state}`] = list;
  }
}
for (const [mirroredDir, sourceDir] of Object.entries(MIRROR_SOURCE)) {
  for (const state of STATES) {
    framesByKey[`${mirroredDir}_${state}`] = framesByKey[`${sourceDir}_${state}`].map(c => c.flipHorizontal());
  }
}

// ---------- Output paths (everything lands in ../assets, next to this tools/ dir) ----------
const assetsDir = path.join(__dirname, '..', 'assets');
const framesDir = path.join(assetsDir, 'frames');

// Individual frames — for manual inspection only, not used by the playground at runtime.
for (const dir of ALL_DIRECTIONS) {
  fs.mkdirSync(path.join(framesDir, dir), { recursive: true });
  for (const state of STATES) {
    framesByKey[`${dir}_${state}`].forEach((c, i) => {
      fs.writeFileSync(path.join(framesDir, dir, `${state}_${i}.png`), c.toPNG());
    });
  }
}

// Composite sheet: rows = directions, columns = idle+walk+run frames concatenated
let colStart = {};
{
  let acc = 0;
  for (const s of STATES) { colStart[s] = acc; acc += STATE_CONFIG[s].frames; }
}
const framesPerRow = STATES.reduce((sum, s) => sum + STATE_CONFIG[s].frames, 0);
const sheet = new Canvas(W * framesPerRow, H * ALL_DIRECTIONS.length);

ALL_DIRECTIONS.forEach((dir, rowIdx) => {
  for (const state of STATES) {
    framesByKey[`${dir}_${state}`].forEach((c, i) => {
      sheet.blit(c, (colStart[state] + i) * W, rowIdx * H);
    });
  }
});
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'character-sheet.png'), sheet.toPNG());

// ---------- Metadata: frame lookup + animation timing, keyed by state/direction ----------
const meta = {
  frameWidth: W,
  frameHeight: H,
  sheetWidth: sheet.w,
  sheetHeight: sheet.h,
  directions: ALL_DIRECTIONS,
  states: STATES,
  animations: {},
};
STATES.forEach(state => {
  meta.animations[state] = {
    frameCount: STATE_CONFIG[state].frames,
    frameDurationMs: STATE_CONFIG[state].durationMs,
    directions: {},
  };
  ALL_DIRECTIONS.forEach((dir, rowIdx) => {
    meta.animations[state].directions[dir] = {
      row: rowIdx,
      colStart: colStart[state],
      x: colStart[state] * W,
      y: rowIdx * H,
    };
  });
});

// Portable JSON form (useful once this integrates into a real project that
// can fetch() it, e.g. served over http:// instead of opened as a file).
fs.writeFileSync(path.join(assetsDir, 'character-meta.json'), JSON.stringify(meta, null, 2));

// Script form: same data, exposed as a global via a classic <script src>,
// so the playground works by just double-clicking index.html — no server,
// no build step, no fetch()/CORS restrictions on the file:// protocol.
const metaJs = `// AUTO-GENERATED by tools/generate-sprites.js — do not edit by hand.\nwindow.CHARACTER_META = ${JSON.stringify(meta)};\n`;
fs.writeFileSync(path.join(assetsDir, 'character-meta.js'), metaJs);

console.log('Done. Assets written to', assetsDir);
console.log('- character-sheet.png (', sheet.w, 'x', sheet.h, ') —', ALL_DIRECTIONS.length, 'directions x', framesPerRow, 'frames');
console.log('- character-meta.json / character-meta.js (frame + animation lookup data)');
console.log('- frames/<direction>/<state>_<i>.png (individual frames, for inspection only)');
