import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import PixelIcon from '../shared/ui/PixelIcon';
import { THEMES, type Settings } from './settings';

interface ToolbarProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReset: () => void;
}

type Panel = 'volume' | 'theme' | 'settings' | null;

/** 右上角工具栏：音量、背景、设置。每个按钮展开一个小弹层，Esc 或点击外部关闭。 */
export default function Toolbar({ settings, onChange, onReset }: ToolbarProps) {
  const [open, setOpen] = useState<Panel>(null);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    const onClick = (e: MouseEvent) => {
      if (host.current && !host.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const toggle = (panel: Panel) => setOpen((cur) => (cur === panel ? null : panel));
  const volumeLabel = settings.muted ? '已静音' : `音量 ${settings.volume}%`;

  return (
    <div className="toolbar" ref={host}>
      <ToolButton label={volumeLabel} active={open === 'volume'} onClick={() => toggle('volume')}>
        <PixelIcon name={settings.muted || settings.volume === 0 ? 'volume-mute' : 'volume'} />
      </ToolButton>
      <ToolButton label="背景调节" active={open === 'theme'} onClick={() => toggle('theme')}>
        <PixelIcon name="palette" />
      </ToolButton>
      <ToolButton label="设置" active={open === 'settings'} onClick={() => toggle('settings')}>
        <PixelIcon name="settings" />
      </ToolButton>

      {open === 'volume' && (
        <Popover title="音量" onClose={() => setOpen(null)}>
          <VolumeControl settings={settings} onChange={onChange} />
        </Popover>
      )}
      {open === 'theme' && (
        <Popover title="背景调节" onClose={() => setOpen(null)}>
          <ThemeControl settings={settings} onChange={onChange} />
        </Popover>
      )}
      {open === 'settings' && (
        <Popover title="设置" onClose={() => setOpen(null)}>
          <SettingsControl settings={settings} onChange={onChange} onReset={onReset} />
        </Popover>
      )}
    </div>
  );
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={active ? 'tool-button active' : 'tool-button'}
      aria-label={label}
      title={label}
      aria-expanded={active}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Popover({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="popover" role="dialog" aria-labelledby={id}>
      <div className="popover-head">
        <span id={id} className="popover-title">{title}</span>
        <button type="button" className="popover-close" aria-label="关闭" onClick={onClose}><PixelIcon name="close" size={10} /></button>
      </div>
      {children}
    </div>
  );
}

function VolumeControl({ settings, onChange }: { settings: Settings; onChange: ToolbarProps['onChange'] }) {
  const id = useId();
  return (
    <div className="popover-body">
      <label htmlFor={id} className="field-label">主音量 <output>{settings.muted ? '静音' : `${settings.volume}%`}</output></label>
      <input
        id={id}
        className="pixel-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={settings.volume}
        disabled={settings.muted}
        onChange={(e) => onChange({ volume: Number(e.currentTarget.value) })}
      />
      <label className="check-row">
        <input type="checkbox" checked={settings.muted} onChange={(e) => onChange({ muted: e.currentTarget.checked })} />
        <span>静音</span>
      </label>
      <p className="field-note">当前版本没有音频，设置会保留到接入背景音乐后。</p>
    </div>
  );
}

function ThemeControl({ settings, onChange }: { settings: Settings; onChange: ToolbarProps['onChange'] }) {
  return (
    <div className="popover-body">
      <div className="theme-options" role="radiogroup" aria-label="背景主题">
        {THEMES.map((theme) => {
          const selected = settings.theme === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? 'theme-option selected' : 'theme-option'}
              data-theme-preview={theme.value}
              onClick={() => onChange({ theme: theme.value })}
            >
              <span className="theme-swatch" aria-hidden="true" />
              <span className="theme-text"><strong>{theme.label}</strong><small>{theme.note}</small></span>
              {selected && <PixelIcon name="check" size={10} />}
            </button>
          );
        })}
      </div>
      <label className="check-row">
        <input type="checkbox" checked={settings.grid} onChange={(e) => onChange({ grid: e.currentTarget.checked })} />
        <span>显示网格底纹</span>
      </label>
    </div>
  );
}

function SettingsControl({ settings, onChange, onReset }: { settings: Settings; onChange: ToolbarProps['onChange']; onReset: () => void }) {
  return (
    <div className="popover-body">
      <label className="check-row">
        <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => onChange({ reduceMotion: e.currentTarget.checked })} />
        <span>减少动画</span>
      </label>
      <label className="check-row">
        <input type="checkbox" checked={settings.showHints} onChange={(e) => onChange({ showHints: e.currentTarget.checked })} />
        <span>显示按键提示</span>
      </label>
      <p className="field-note">偏好保存在本浏览器，不会上传。</p>
      <button type="button" className="pixel-button ghost small" onClick={onReset}>
        <PixelIcon name="reset" size={11} />
        恢复默认
      </button>
    </div>
  );
}
