import type { ReactNode } from 'react';
import PixelIcon from '../shared/ui/PixelIcon';

interface PageShellProps {
  eyebrow: string;
  title: string;
  /** 右上角额外内容（状态标签、操作按钮）。 */
  aside?: ReactNode;
  backLabel?: string;
  onBack: () => void;
  onHome?: () => void;
  children: ReactNode;
  className?: string;
}

/** 二级页面统一外壳：品牌块 + 标题 + 返回/首页，保持与启动界面同一套像素令牌。 */
export default function PageShell({ eyebrow, title, aside, backLabel = '返回', onBack, onHome, children, className }: PageShellProps) {
  return (
    <main className={className ? `page-shell ${className}` : 'page-shell'}>
      <header className="page-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div className="page-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="page-actions">
          {aside}
          <button type="button" className="back-button" onClick={onBack}>
            <PixelIcon name="arrow-left" size={10} />
            {backLabel}
          </button>
          {onHome && (
            <button type="button" className="back-button" aria-label="回到首页" title="回到首页" onClick={onHome}>
              <PixelIcon name="home" size={11} />
            </button>
          )}
        </div>
      </header>
      {children}
    </main>
  );
}
