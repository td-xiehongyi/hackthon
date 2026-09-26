import { useCallback, useEffect, useState } from 'react';

/**
 * 启动界面的角色选择。
 * 当前只有 character-playground-prototype 的占位造型可用；配色变体通过 CSS 色相偏移实现，
 * 不代表正式角色美术。正式角色由 E 组提供后替换 sheet 与 meta。
 */
export interface CharacterOption {
  id: string;
  name: string;
  note: string;
  hue: number;          // hue-rotate 角度，0 为原始配色
  available: boolean;
}

export const CHARACTERS: CharacterOption[] = [
  { id: 'orange', name: '橙橙', note: '原型占位造型', hue: 0, available: true },
  { id: 'mint', name: '青青', note: '配色变体', hue: 150, available: true },
  { id: 'rose', name: '粉粉', note: '配色变体', hue: 300, available: true },
  { id: 'violet', name: '紫紫', note: '配色变体', hue: 240, available: true },
  { id: 'student', name: '正式角色', note: '待 E 组素材接入', hue: 0, available: false },
];

const KEY = 'csu.character.v1';

function load(): string {
  try {
    const id = localStorage.getItem(KEY);
    if (id && CHARACTERS.some((c) => c.id === id && c.available)) return id;
  } catch {
    // ignore
  }
  return CHARACTERS[0].id;
}

export function useCharacter() {
  const [characterId, setCharacterId] = useState<string>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, characterId);
    } catch {
      // ignore
    }
  }, [characterId]);
  const character = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  const select = useCallback((id: string) => {
    const target = CHARACTERS.find((c) => c.id === id);
    if (target?.available) setCharacterId(id);
  }, []);
  return { character, select };
}
