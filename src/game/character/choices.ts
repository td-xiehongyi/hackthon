export interface CharacterChoice {
  id: string;
  name: string;
  note: string;
  dir: string;
  scale: number;
  hue: number;
  preview: { sheet: string; sheetWidth: number; sheetHeight: number; x: number; y: number; width: number; height: number };
}

/** 首页使用各素材包的向下待机帧；照片角色仍是待验收的候选素材。 */
export const CHARACTER_CHOICES: readonly CharacterChoice[] = [
  { id: 'photo-student', name: '粉白开衫女生', note: '动画候选 · 待精修', dir: '/characters/photo-student', scale: 0.1, hue: 0,
    preview: { sheet: 'walk-cycle.png', sheetWidth: 1254, sheetHeight: 1254, x: 375, y: 0, width: 250, height: 316 } },
  { id: 'photo-sage-student', name: '棕发绿包女生', note: '动画候选 · 待精修', dir: '/characters/photo-sage-student', scale: 0.1, hue: 0,
    preview: { sheet: 'walk-cycle-v2.png', sheetWidth: 1254, sheetHeight: 1254, x: 313, y: 0, width: 314, height: 329 } },
  { id: 'photo-gray-student', name: '灰衣黑包男生', note: '完整候选包 · 待验收', dir: '/characters/photo-gray-student', scale: 0.1, hue: 0,
    preview: { sheet: 'walk-cycle.png', sheetWidth: 1254, sheetHeight: 1254, x: 313, y: 0, width: 314, height: 315 } },
  { id: 'photo-olive-student', name: '圆框眼镜男生', note: '左右步态已修订 · 候选素材', dir: '/characters/photo-olive-student', scale: 0.1, hue: 0,
    preview: { sheet: 'walk-cycle.png', sheetWidth: 1254, sheetHeight: 1254, x: 313, y: 0, width: 314, height: 317 } },
  { id: 'photo-point-cat', name: '照片蓝眼长毛猫', note: '动画候选 · 待精修', dir: '/characters/photo-point-cat', scale: 0.1, hue: 0,
    preview: { sheet: 'walk-cycle.png', sheetWidth: 1312, sheetHeight: 1199, x: 0, y: 0, width: 335, height: 299 } },
  { id: 'temp-prototype-blob', name: '临时测试角色', note: '临时原型 · 非正式人物', dir: '/characters/temp-prototype', scale: 1, hue: 0,
    preview: { sheet: 'character-sheet.png', sheetWidth: 240, sheetHeight: 176, x: 0, y: 0, width: 20, height: 22 } },
];
const STORAGE_KEY = 'csu-campus-character';

export function readCharacterChoice(): CharacterChoice {
  try {
    return CHARACTER_CHOICES.find(choice => choice.id === localStorage.getItem(STORAGE_KEY)) ?? CHARACTER_CHOICES[0];
  } catch { return CHARACTER_CHOICES[0]; }
}

export function saveCharacterChoice(choice: CharacterChoice) {
  // 禁用本地存储时仍可在当前页面选角和进入校园。
  try { localStorage.setItem(STORAGE_KEY, choice.id); } catch { /* session only */ }
}
