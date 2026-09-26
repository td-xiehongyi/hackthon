/**
 * 应用首页：地图探索页 ↔ 地点功能页的宿主。
 *
 * v20 地图的行走区、碰撞与三个互动入口尚未标定：角色可在“角色”模式下临时自由移动，
 * 但不会发出打开请求——宿主已挂载，等待入口标注完成后由地图场景接入。
 * 完整的“进入范围 → 按 E → 功能页 → 返回原位”链路在开发测试场景中验证（/?scene=dev-playground）。
 */

import { useCallback, useRef, useState } from 'react';
import MapViewport from '../game/MapViewport';
import { MAP_IMAGE_PATH } from '../shared/contracts';
import PlaceHost, { type PlaceHostHandle } from './PlaceHost';

export default function App() {
  const hostHandle = useRef<PlaceHostHandle | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);

  const registerHandle = useCallback((handle: PlaceHostHandle | null) => {
    hostHandle.current = handle;
  }, []);

  // 正式地图接入角色后：暂停移动并清键 / 恢复按 E 时的原位置与朝向。
  const onSuspendMap = useCallback(() => {}, []);
  const onResumeMap = useCallback(() => {}, []);

  return (
    <main className="campus-app">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <div><p className="eyebrow">CSU PIXEL CAMPUS</p><h1>中南大学像素校园</h1></div>
        <span className="preview-label">{placeOpen ? '地点功能页' : '地图预览'}</span>
      </header>

      <PlaceHost
        onSuspendMap={onSuspendMap}
        onResumeMap={onResumeMap}
        registerHandle={registerHandle}
        onOpenChange={setPlaceOpen}
      >
        {/* 地图探索页：功能页打开时保留地图状态并暂停探索，因此保持挂载。 */}
        <div className="workspace" hidden={placeOpen}>
          <aside className="sidebar">
            <div>
              <span className="section-number">01 / CAMPUS MAP</span>
              <h2>从这里，<br />看见校园。</h2>
              <p className="intro">沿着道路与湖畔，浏览三个校区的像素风景。</p>
            </div>
            <div className="campus-list" aria-label="图中校区">
              <div><span>01</span>岳麓山校区</div>
              <div><span>02</span>麓南校区</div>
              <div><span>03</span>潇湘校区</div>
            </div>
            <div className="preview-note">
              <strong>角色已在地图中心，直接按键跑动</strong>
              <p>WASD 移动，按住 Shift 骑行；点“浏览”可拖动查看全图。</p>
              <p>角色只能走道路、步道和桥面（自动提取，待核验）；地点入口仍待标定。</p>
            </div>
            <a className="original-link" href={MAP_IMAGE_PATH} target="_blank" rel="noreferrer">查看完整原图 <span aria-hidden="true">↗</span></a>
          </aside>
          <MapViewport />
        </div>
      </PlaceHost>
    </main>
  );
}
