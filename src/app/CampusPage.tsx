import type { CampusId } from '../shared/contracts';
import PixelIcon from '../shared/ui/PixelIcon';
import PageShell from './PageShell';
import { CAMPUSES, PLACES, findCampus } from './campuses';
import type { Route } from './router';

interface CampusPageProps {
  campusId: CampusId;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}

/** 校区页：简介、地标清单、可互动地点入口，以及跳到相邻校区。 */
export default function CampusPage({ campusId, onNavigate, onBack }: CampusPageProps) {
  const campus = findCampus(campusId);
  const index = CAMPUSES.findIndex((c) => c.id === campus.id);
  const prev = CAMPUSES[(index - 1 + CAMPUSES.length) % CAMPUSES.length];
  const next = CAMPUSES[(index + 1) % CAMPUSES.length];

  return (
    <PageShell
      className="campus-page"
      eyebrow={`CAMPUS ${campus.index}`}
      title={campus.name}
      onBack={onBack}
      onHome={() => onNavigate({ name: 'start' })}
      aside={
        <button type="button" className="back-button" onClick={() => onNavigate({ name: 'map' })}>
          <PixelIcon name="map" size={11} />
          在地图上浏览
        </button>
      }
    >
      <section className="campus-hero">
        <div className="campus-hero-copy">
          <span className="campus-plate">{campus.name}</span>
          <p className="hero-lead">{campus.intro}</p>
          <dl className="campus-facts">
            <div><dt>地标</dt><dd>{campus.landmarks.length} 处</dd></div>
            <div><dt>功能地点</dt><dd>{campus.placeIds.length ? `${campus.placeIds.length} 处` : '暂无'}</dd></div>
            <div><dt>坐标标定</dt><dd>待核验</dd></div>
          </dl>
        </div>
        <figure className="campus-thumb" aria-label={`${campus.name}地图缩略`}>
          <img src="/maps/campus-final-v9.png" alt="" width="1041" height="1511" decoding="async" data-campus={campus.id} />
        </figure>
      </section>

      <section className="campus-section" aria-labelledby="landmark-title">
        <div className="panel-head">
          <span className="section-number">LANDMARKS</span>
          <h2 id="landmark-title" className="panel-title">地标</h2>
        </div>
        <ul className="landmark-list">
          {campus.landmarks.map((name) => (
            <li key={name} className="landmark-item">
              <PixelIcon name="pin" size={12} />
              <span>{name}</span>
              <small>待标定</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="campus-section" aria-labelledby="place-title">
        <div className="panel-head">
          <span className="section-number">PLACES</span>
          <h2 id="place-title" className="panel-title">可互动地点</h2>
        </div>
        {campus.placeIds.length === 0 ? (
          <p className="field-note">首版只在潇湘校区提供功能地点；本校区仅供地图浏览。</p>
        ) : (
          <div className="place-grid">
            {campus.placeIds.map((placeId) => {
              const place = PLACES[placeId];
              return (
                <button
                  key={placeId}
                  type="button"
                  className="place-card"
                  onClick={() => onNavigate({ name: 'place', placeId })}
                >
                  <span className="place-card-head">
                    <span className="campus-plate">{place.identity.name}</span>
                    <span className="place-owner">{place.owner} 组</span>
                  </span>
                  <span className="place-summary">{place.summary}</span>
                  <span className="place-enter"><PixelIcon name="arrow-right" size={10} />进入</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <nav className="campus-pager" aria-label="切换校区">
        <button type="button" className="pixel-button ghost small" onClick={() => onNavigate({ name: 'campus', campusId: prev.id })}>
          <PixelIcon name="arrow-left" size={11} />
          {prev.name}
        </button>
        <button type="button" className="pixel-button ghost small" onClick={() => onNavigate({ name: 'campus', campusId: next.id })}>
          {next.name}
          <PixelIcon name="arrow-right" size={11} />
        </button>
      </nav>
    </PageShell>
  );
}
