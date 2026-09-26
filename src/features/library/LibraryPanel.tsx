import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import './LibraryPanel.css';

const CAMPUS_LABELS: Record<string, string> = {
  yuelushan: '岳麓山校区',
  lunan: '麓南校区',
  xiaoxiang: '潇湘校区',
};

export default function LibraryPanel({
  place,
  onRequestClose,
  registerCloseGuard,
}: PlacePanelProps) {
  const [busy, setBusy] = useState(false);

  // 上传进行中注册关闭守卫，避免异步回调作用到已关闭的窗口。
  useEffect(() => {
    if (!busy) return;
    const unregister = registerCloseGuard(() => false);
    return unregister;
  }, [busy, registerCloseGuard]);

  return (
    <section className="library-panel" aria-label={place.name}>
      <header className="library-header">
        <div>
          <span className="library-eyebrow">图书馆 · LIBRARY</span>
          <h1>{place.name}</h1>
          <p className="library-campus">{CAMPUS_LABELS[place.campusId] ?? place.campusId}</p>
        </div>
        <button type="button" className="library-back" onClick={onRequestClose}>返回校园</button>
      </header>

      <div className="library-info">
        <h2>地点介绍</h2>
        <p className="library-missing" role="status">简介内容缺失，待核验补充。</p>
        <h2>信息来源</h2>
        <p className="library-missing" role="status">来源信息缺失，待核验补充。</p>
      </div>

      <PlaceGallery placeId={place.placeId} onActivityChange={setBusy} />
    </section>
  );
}
