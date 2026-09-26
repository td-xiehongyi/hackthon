import { useCallback, useEffect, useState } from 'react';

/** 启动界面的本机偏好，保存在浏览器 localStorage；不涉及公共数据。 */
export type Theme = 'grass' | 'dusk' | 'night';

export interface Settings {
  volume: number;        // 0–100
  muted: boolean;
  theme: Theme;
  grid: boolean;         // 页面网格底纹
  reduceMotion: boolean; // 关闭取景框与角色动画
  showHints: boolean;    // 显示按键提示
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 70,
  muted: false,
  theme: 'grass',
  grid: true,
  reduceMotion: false,
  showHints: true,
};

export const THEMES: { value: Theme; label: string; note: string }[] = [
  { value: 'grass', label: '草地', note: '与地图同色的日间配色' },
  { value: 'dusk', label: '暮色', note: '偏暖的傍晚色调' },
  { value: 'night', label: '夜间', note: '深色底，地图略微压暗' },
];

const KEY = 'csu.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** 把偏好写到 <html> 的 data 属性上，CSS 按属性切换令牌。 */
export function applySettings(settings: Settings) {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.grid = settings.grid ? 'on' : 'off';
  root.dataset.motion = settings.reduceMotion ? 'reduce' : 'auto';
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  useEffect(() => {
    applySettings(settings);
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // 存储不可用时仅在本次会话内生效
    }
  }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch })), []);
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  return { settings, update, reset };
}
