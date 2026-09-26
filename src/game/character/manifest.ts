/**
 * CharacterManifest 校验（docs/04 第 3、4、7 节）。
 *
 * 纯函数，不依赖 Phaser；运行时加载与单元测试共用同一套规则。
 * 返回全部问题而不是遇到第一个就停止，便于素材作者一次修完。
 */

import type {
  CharacterAction,
  CharacterClip,
  CharacterManifest,
  Direction,
  MovementMode,
} from '@/shared/contracts';

export const MODES: readonly MovementMode[] = ['walk', 'ride'];
export const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];
export const ACTIONS: readonly CharacterAction[] = ['idle', 'move'];

export function clipKey(mode: MovementMode, facing: Direction, action: CharacterAction) {
  return `${mode}/${facing}/${action}`;
}

const isInt = (value: unknown): value is number => Number.isInteger(value);
const isNonNegInt = (value: unknown): value is number => isInt(value) && value >= 0;
const isPosInt = (value: unknown): value is number => isInt(value) && value > 0;
const isFiniteNum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** sheet.url 必须是相对 manifest 目录的路径：不能是绝对路径、协议 URL 或越出目录。 */
function isRelativeAssetPath(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false; // http:, file:, C: 等
  if (url.startsWith('/') || url.startsWith('\\')) return false;
  return !url.split(/[\\/]/).includes('..');
}

export function validateManifest(input: unknown): string[] {
  const problems: string[] = [];
  const m = input as Partial<CharacterManifest> | null;
  if (typeof m !== 'object' || m === null) return ['manifest 不是对象'];
  if (m.schemaVersion !== 1) problems.push('schemaVersion 必须为 1');
  if (typeof m.characterId !== 'string' || m.characterId.length === 0) {
    problems.push('characterId 必须为非空字符串');
  }

  const sheets = new Map<string, { width: number; height: number }>();
  if (!Array.isArray(m.sheets) || m.sheets.length === 0) {
    problems.push('sheets 必须为非空数组');
  } else {
    m.sheets.forEach((sheet, i) => {
      const at = `sheets[${i}]`;
      const idOk = typeof sheet.id === 'string' && sheet.id.length > 0;
      if (!idOk) problems.push(`${at}.id 必须为非空字符串`);
      else if (sheets.has(sheet.id)) problems.push(`${at}.id 重复：${sheet.id}`);
      if (!isRelativeAssetPath(sheet.url)) problems.push(`${at}.url 必须是相对 manifest 目录的路径`);
      if (!isPosInt(sheet.width) || !isPosInt(sheet.height)) problems.push(`${at} 宽高必须为正整数`);
      else if (idOk) sheets.set(sheet.id, { width: sheet.width, height: sheet.height });
    });
  }

  const seen = new Set<string>();
  if (!Array.isArray(m.clips)) {
    problems.push('clips 必须为数组');
    return problems;
  }
  m.clips.forEach((clip: CharacterClip, i) => {
    const at = `clips[${i}]`;
    if (!MODES.includes(clip.mode) || !FACINGS.includes(clip.facing) || !ACTIONS.includes(clip.action)) {
      problems.push(`${at} 的 mode/facing/action 不在允许范围内`);
      return;
    }
    const key = clipKey(clip.mode, clip.facing, clip.action);
    if (seen.has(key)) problems.push(`${at} 状态重复：${key}`);
    seen.add(key);
    if (clip.loop !== true) problems.push(`${at}（${key}）loop 首版必须为 true`);
    if (!Array.isArray(clip.frames) || clip.frames.length === 0) {
      problems.push(`${at}（${key}）frames 不能为空`);
      return;
    }
    clip.frames.forEach((frame, j) => {
      const fat = `${at}.frames[${j}]`;
      const sheet = sheets.get(frame.sheetId);
      if (!sheet) problems.push(`${fat}.sheetId 未声明：${frame.sheetId}`);
      const r = frame.rect;
      if (!r || !isNonNegInt(r.x) || !isNonNegInt(r.y) || !isPosInt(r.width) || !isPosInt(r.height)) {
        problems.push(`${fat}.rect 坐标须为非负整数、宽高须为正整数`);
      } else {
        if (sheet && (r.x + r.width > sheet.width || r.y + r.height > sheet.height)) {
          problems.push(`${fat}.rect 越出 ${frame.sheetId} 的范围`);
        }
        const a = frame.anchor;
        if (!a || !isFiniteNum(a.x) || !isFiniteNum(a.y)) problems.push(`${fat}.anchor 必须为有限数值`);
        else if (a.x < 0 || a.y < 0 || a.x > r.width || a.y > r.height) {
          problems.push(`${fat}.anchor 必须位于帧内或边界上`);
        }
      }
      if (!isFiniteNum(frame.durationMs) || frame.durationMs <= 0) {
        problems.push(`${fat}.durationMs 必须为大于 0 的有限数`);
      }
    });
  });
  for (const mode of MODES) {
    for (const facing of FACINGS) {
      for (const action of ACTIONS) {
        const key = clipKey(mode, facing, action);
        if (!seen.has(key)) problems.push(`缺少状态：${key}`);
      }
    }
  }
  return problems;
}
