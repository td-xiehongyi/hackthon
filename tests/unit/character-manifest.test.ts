import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

// Validates the placeholder character manifest against the structural rules
// in docs/contracts/campus-v1.d.ts and docs/04_角色素材接口.md §3, §4, §7.
// This checks file/data integrity only (readable PNGs, correct dimensions,
// 16 unique state entries, in-bounds frame rects). It does NOT verify visual
// quality (silhouette clarity, transparency correctness) — that still
// requires a human looking at the rendered sprite sheets.

const CHAR_DIR = path.join('public', 'characters', 'student');
const MANIFEST_PATH = path.join(CHAR_DIR, 'manifest.json');

interface Rect { x: number; y: number; width: number; height: number }
interface SpriteSheet { id: string; url: string; width: number; height: number }
interface SpriteFrame { sheetId: string; rect: Rect; anchor: { x: number; y: number }; durationMs: number }
interface CharacterClip { mode: string; facing: string; action: string; loop: boolean; frames: SpriteFrame[] }
interface CharacterManifest {
  schemaVersion: number;
  characterId: string;
  sheets: SpriteSheet[];
  clips: CharacterClip[];
}

function readPngDimensions(filePath: string): [number, number] {
  const buf = readFileSync(filePath);
  expect(buf.subarray(0, 8).toString('hex'), `${filePath} must start with the PNG signature`).toBe(
    '89504e470d0a1a0a',
  );
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

describe('placeholder character manifest (public/characters/student)', () => {
  test('manifest.json exists and parses', () => {
    expect(existsSync(MANIFEST_PATH), '素材说明第 4 项要求交付 manifest.json').toBe(true);
  });

  const manifest: CharacterManifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

  test('schemaVersion is fixed to 1', () => {
    expect(manifest.schemaVersion).toBe(1);
  });

  test('sheet ids are unique and each PNG matches its declared dimensions', () => {
    const ids = manifest.sheets.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sheet of manifest.sheets) {
      const filePath = path.join(CHAR_DIR, sheet.url);
      expect(existsSync(filePath), `${sheet.url} referenced by manifest must exist`).toBe(true);
      const [w, h] = readPngDimensions(filePath);
      expect([w, h], `${sheet.url} actual pixel size must match manifest`).toEqual([sheet.width, sheet.height]);
    }
  });

  test('exactly the 16 required (mode, facing, action) combinations are present, no duplicates', () => {
    const modes = ['walk', 'ride'];
    const facings = ['up', 'down', 'left', 'right'];
    const actions = ['idle', 'move'];
    const expected = new Set(modes.flatMap((m) => facings.flatMap((f) => actions.map((a) => `${m}:${f}:${a}`))));

    const seen = manifest.clips.map((c) => `${c.mode}:${c.facing}:${c.action}`);
    expect(new Set(seen).size, 'no (mode, facing, action) combination may repeat').toBe(seen.length);
    expect(new Set(seen)).toEqual(expected);
    expect(manifest.clips.length).toBe(16);
  });

  test('every clip loops, has at least one frame, and idle/move frame counts follow the interface contract', () => {
    for (const clip of manifest.clips) {
      expect(clip.loop, `${clip.mode}/${clip.facing}/${clip.action} must loop per interface v1.0.0 §3`).toBe(true);
      expect(clip.frames.length, `${clip.mode}/${clip.facing}/${clip.action} must have at least one frame`).toBeGreaterThan(0);
      if (clip.action === 'idle') {
        expect(clip.frames.length, 'idle may be a single frame but must be declared').toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('every frame rect stays within its sheet bounds and every duration is a positive finite number', () => {
    const sheetById = new Map(manifest.sheets.map((s) => [s.id, s]));
    for (const clip of manifest.clips) {
      for (const frame of clip.frames) {
        const sheet = sheetById.get(frame.sheetId);
        expect(sheet, `frame references unknown sheetId ${frame.sheetId}`).toBeDefined();
        const { rect } = frame;
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(sheet!.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(sheet!.height);
        expect(Number.isFinite(frame.durationMs) && frame.durationMs > 0).toBe(true);
      }
    }
  });

  test('anchor point stays inside (or on the border of) its own frame canvas', () => {
    for (const clip of manifest.clips) {
      for (const frame of clip.frames) {
        expect(frame.anchor.x).toBeGreaterThanOrEqual(0);
        expect(frame.anchor.y).toBeGreaterThanOrEqual(0);
        expect(frame.anchor.x).toBeLessThanOrEqual(frame.rect.width);
        expect(frame.anchor.y).toBeLessThanOrEqual(frame.rect.height);
      }
    }
  });

  test('mirrored left/right anchors stay horizontally symmetric within each mode+action', () => {
    const byKey = new Map<string, CharacterClip>();
    for (const clip of manifest.clips) byKey.set(`${clip.mode}:${clip.facing}:${clip.action}`, clip);
    for (const mode of ['walk', 'ride']) {
      for (const action of ['idle', 'move']) {
        const right = byKey.get(`${mode}:right:${action}`)!;
        const left = byKey.get(`${mode}:left:${action}`)!;
        expect(left.frames.length).toBe(right.frames.length);
        left.frames.forEach((leftFrame, i) => {
          const rightFrame = right.frames[i];
          expect(leftFrame.rect.width).toBe(rightFrame.rect.width);
          const mirroredAnchorX = leftFrame.rect.width - leftFrame.anchor.x;
          expect(Math.abs(mirroredAnchorX - rightFrame.anchor.x)).toBeLessThanOrEqual(1);
        });
      }
    }
  });
});
