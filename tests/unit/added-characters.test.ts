import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CHARACTER_CHOICES } from '@/game/character/choices';
import { validateManifest } from '@/game/character/manifest';
import type { CharacterManifest } from '@/shared/contracts';

describe('新增首页角色的运行素材', () => {
  for (const [id, stage] of [['photo-olive-student', 'e4'], ['photo-point-cat', 'e3']]) {
    test(`${id} 使用完整已选定素材，首页头像与向下待机一致`, () => {
      const choice = CHARACTER_CHOICES.find(c => c.id === id);
      expect(choice, '角色必须可从首页选择').toBeDefined();
      const runtime = `public${choice!.dir}`;
      const source = `assets/characters/${id}/${stage}`;
      const manifestBytes = readFileSync(`${runtime}/manifest.json`);
      expect(manifestBytes.equals(readFileSync(`${source}/manifest.json`))).toBe(true);
      const manifest: CharacterManifest = JSON.parse(manifestBytes.toString());
      expect(manifest.characterId).toBe(id);
      expect(validateManifest(manifest)).toEqual([]);
      expect(manifest.clips).toHaveLength(16);
      for (const sheet of manifest.sheets) {
        const bytes = readFileSync(`${runtime}/${sheet.url}`);
        expect(bytes.equals(readFileSync(`${source}/${sheet.url}`))).toBe(true);
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([sheet.width, sheet.height]);
      }
      const idle = manifest.clips.find(c => c.mode === 'walk' && c.facing === 'down' && c.action === 'idle')!.frames[0];
      const sheet = manifest.sheets.find(s => s.id === idle.sheetId)!;
      expect(choice!.preview).toEqual({ sheet: sheet.url, sheetWidth: sheet.width, sheetHeight: sheet.height, ...idle.rect });
      expect(choice!.scale).toBe(0.1);
      if (id === 'photo-olive-student') {
        for (const facing of ['left', 'right']) {
          expect(manifest.clips.find(c => c.mode === 'walk' && c.facing === facing && c.action === 'move')!.frames.every(f => f.sheetId === 'walk-sides-v2')).toBe(true);
        }
      }
    });
  }
});
