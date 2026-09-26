import PixelIcon from '../shared/ui/PixelIcon';
import PageShell from './PageShell';
import type { Route } from './router';

interface FullMapPageProps {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}

/** 完整原图页：按原始像素比例展示 1041 × 1511 地图，可滚动；不做缩放，缩放交给地图页。 */
export default function FullMapPage({ onNavigate, onBack }: FullMapPageProps) {
  return (
    <PageShell
      className="full-map-page"
      eyebrow="CAMPUS MAP · ORIGINAL"
      title="完整地图"
      onBack={onBack}
      onHome={() => onNavigate({ name: 'start' })}
      aside={
        <>
          <span className="preview-label">1041 × 1511 · v9</span>
          <button type="button" className="back-button" onClick={() => onNavigate({ name: 'map' })}>
            <PixelIcon name="map" size={11} />
            交互浏览
          </button>
          <a className="back-button" href="/maps/campus-final-v9.png" download="中南大学像素校园-最终地图.png">
            <PixelIcon name="external" size={11} />
            下载原图
          </a>
        </>
      }
    >
      <div className="full-map-scroll">
        <img
          className="full-map-image"
          src="/maps/campus-final-v9.png"
          alt="中南大学像素校园完整地图，含岳麓山、麓南、潇湘三个校区"
          width="1041"
          height="1511"
          decoding="async"
        />
      </div>
      <p className="full-map-caption">最终地图 v9 · 无路线标记版 · 按原始像素 1:1 显示，拖动滚动条浏览</p>
    </PageShell>
  );
}
