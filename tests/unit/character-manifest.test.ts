import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { CharacterManifest } from '@/shared/contracts';
import { validateManifest } from '@/game/character/manifest';

const DIR = 'public/characters/temp-prototype';
const manifest: CharacterManifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf-8'));

describe('临时原型角色 manifest', () => {
  test('符合角色素材契约：16 个状态、帧不越界、锚点在帧内、时长有效', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.clips).toHaveLength(16);
  });

  test('声明尺寸与 PNG 实际尺寸一致，且雪碧图带 Alpha 通道', () => {
    for (const sheet of manifest.sheets) {
      const png = readFileSync(`${DIR}/${sheet.url}`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([sheet.width, sheet.height]);
      expect(png[25], 'PNG colour type 6 = RGBA').toBe(6);
    }
  });

  test('来源记录中的哈希与实际雪碧图一致', () => {
    const png = readFileSync(`${DIR}/character-sheet.png`);
    const sha = createHash('sha256').update(png).digest('hex');
    expect(readFileSync(`${DIR}/SOURCE.md`, 'utf-8')).toContain(sha);
  });

  test('所有帧使用同一锚点，换帧、换向与切换模式时落地点不漂移', () => {
    const anchors = new Set(
      manifest.clips.flatMap((clip) => clip.frames.map((f) => `${f.anchor.x},${f.anchor.y}`)),
    );
    expect(anchors.size).toBe(1);
  });

  test('临时素材不占用 E 的正式目录', () => {
    expect(DIR).not.toContain('characters/student');
  });
});

describe('manifest 校验器能发现违规', () => {
  const clone = (): CharacterManifest => JSON.parse(JSON.stringify(manifest));

  test('缺少状态', () => {
    const m = clone();
    m.clips = m.clips.filter((c) => !(c.mode === 'ride' && c.facing === 'left' && c.action === 'move'));
    expect(validateManifest(m)).toContain('缺少状态：ride/left/move');
  });

  test('重复状态、帧越界、锚点越界、时长无效、未声明 sheet', () => {
    const m = clone();
    m.clips.push(JSON.parse(JSON.stringify(m.clips[0])));
    m.clips[1]!.frames[0]!.rect.x = 235;
    m.clips[2]!.frames[0]!.anchor = { x: 99, y: 5 };
    m.clips[3]!.frames[0]!.durationMs = 0;
    m.clips[4]!.frames[0]!.sheetId = 'missing';
    const problems = validateManifest(m).join('\n');
    expect(problems).toMatch(/状态重复/);
    expect(problems).toMatch(/越出/);
    expect(problems).toMatch(/anchor 必须位于帧内/);
    expect(problems).toMatch(/durationMs/);
    expect(problems).toMatch(/sheetId 未声明/);
  });

  test('sheet url 不能是绝对路径、外站地址或越出目录', () => {
    for (const url of ['/abs.png', 'C:/x.png', 'https://example.com/a.png', '../a.png', '']) {
      const m = clone();
      m.sheets[0]!.url = url;
      expect(validateManifest(m).join('\n'), url).toMatch(/url 必须是相对/);
    }
  });

  test('loop 必须为 true', () => {
    const m = clone();
    m.clips[0]!.loop = false;
    expect(validateManifest(m).join('\n')).toMatch(/loop/);
  });
});
