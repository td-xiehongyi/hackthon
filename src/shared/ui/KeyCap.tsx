interface KeyCapProps {
  children: string;
  wide?: boolean;
}

/** 像素风按键提示。仅作视觉说明，不绑定任何键盘事件。 */
export default function KeyCap({ children, wide = false }: KeyCapProps) {
  return <kbd className={wide ? 'keycap keycap-wide' : 'keycap'}>{children}</kbd>;
}
