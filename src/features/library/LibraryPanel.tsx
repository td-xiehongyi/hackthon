/**
 * 潇湘校区图书馆功能页（FR-06）。
 *
 * 地点介绍与信息来源尚未核验（需求 7.2），因此显示明确的缺失状态，不用未经核实的介绍补齐。
 * 核验后在 LIBRARY_INFO 中填入 summary 与 sources 即可。
 */

import type { PlacePanelProps } from '@/shared/contracts';
import PlaceGallery from '@/shared/gallery/PlaceGallery';

const CAMPUS_NAMES = { yuelushan: '岳麓山校区', lunan: '麓南校区', xiaoxiang: '潇湘校区' } as const;

interface LibraryInfo {
  summary: string | null;
  sources: { label: string; url: string }[];
}

/** 已核验的图书馆介绍。未核验前保持空。 */
export const LIBRARY_INFO: LibraryInfo = { summary: null, sources: [] };

export default function LibraryPanel({ place, onRequestClose }: PlacePanelProps) {
  return (
    <section className="place-panel" aria-label={`${place.name}功能页面`}>
      <header className="place-header">
        <div>
          <p className="eyebrow">LIBRARY</p>
          <h2>{place.name}</h2>
          <p className="place-meta">所属校区：{CAMPUS_NAMES[place.campusId]}</p>
        </div>
        <button className="place-return" onClick={onRequestClose}>返回校园</button>
      </header>

      <div className="place-section">
        <h3>地点介绍</h3>
        {LIBRARY_INFO.summary ? (
          <p>{LIBRARY_INFO.summary}</p>
        ) : (
          <p className="place-missing" role="note">介绍内容尚未核验，暂不显示。</p>
        )}
        <h3>信息来源</h3>
        {LIBRARY_INFO.sources.length > 0 ? (
          <ul>
            {LIBRARY_INFO.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
            ))}
          </ul>
        ) : (
          <p className="place-missing">暂无已核验来源。</p>
        )}
      </div>

      <PlaceGallery placeId={place.placeId} />
    </section>
  );
}
