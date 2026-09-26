import MapViewport from '../game/MapViewport';
import PixelIcon from '../shared/ui/PixelIcon';
import PageShell from './PageShell';
import { CAMPUSES } from './campuses';
import type { Route } from './router';

interface MapPageProps {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}

/** 地图浏览页：Phaser 视口 + 左侧校区索引，校区与"完整原图"都可点进对应页面。 */
export default function MapPage({ onNavigate, onBack }: MapPageProps) {
  return (
    <PageShell
      className="campus-app"
      eyebrow="CSU PIXEL CAMPUS"
      title="中南大学像素校园"
      backLabel="返回首页"
      onBack={onBack}
      aside={<span className="preview-label">地图预览</span>}
    >
      <div className="workspace">
        <aside className="sidebar">
          <div>
            <span className="section-number">01 / CAMPUS MAP</span>
            <h2>从这里，<br />看见校园。</h2>
            <p className="intro">沿着道路与湖畔，浏览三个校区的像素风景。</p>
          </div>
          <nav className="campus-list" aria-label="图中校区">
            {CAMPUSES.map((campus) => (
              <button
                key={campus.id}
                type="button"
                className="campus-list-item"
                onClick={() => onNavigate({ name: 'campus', campusId: campus.id })}
              >
                <span>{campus.index}</span>{campus.name}
                <PixelIcon name="arrow-right" size={9} className="campus-list-arrow" />
              </button>
            ))}
          </nav>
          <div className="preview-note">
            <strong>当前可浏览地图</strong>
            <p>角色移动与地点交互待接入</p>
            <p>道路、碰撞和入口仍待标定。</p>
          </div>
          <button type="button" className="original-link" onClick={() => onNavigate({ name: 'full-map' })}>
            查看完整原图 <span aria-hidden="true">↗</span>
          </button>
        </aside>
        <MapViewport />
      </div>
    </PageShell>
  );
}
