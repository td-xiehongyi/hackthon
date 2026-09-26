import KeyCap from '../shared/ui/KeyCap';
import PixelIcon from '../shared/ui/PixelIcon';
import PixelSprite from '../shared/ui/PixelSprite';
import CharacterPanel from './CharacterPanel';
import Toolbar from './Toolbar';
import { CAMPUSES, PLACES } from './campuses';
import { useCharacter } from './characters';
import type { Route } from './router';
import { useSettings } from './settings';

interface StartScreenProps {
  onNavigate: (route: Route) => void;
}

export default function StartScreen({ onNavigate }: StartScreenProps) {
  const { settings, update, reset } = useSettings();
  const { character, select } = useCharacter();

  return (
    <main className="start-screen">
      <header className="start-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <span className="start-header-title">中南大学像素校园</span>
        <span className="version-tag">v0.1 · 本机运行</span>
        <Toolbar settings={settings} onChange={update} onReset={reset} />
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <CharacterPanel character={character} onSelect={select} />

        <div className="hero-copy">
          <p className="eyebrow">CSU PIXEL CAMPUS</p>
          <h1 id="hero-title" className="pixel-title" aria-label="中南大学像素校园">
            中南大学<br />像素校园
          </h1>
          <p className="hero-lead">三个校区连成一张地图。沿着校园道路探索，靠近地点，按下 E 进入互动。</p>
          <div className="hero-actions">
            <button type="button" className="pixel-button primary" onClick={() => onNavigate({ name: 'map' })}>
              <PixelIcon name="arrow-right" size={12} />
              进入校园
            </button>
            <button type="button" className="pixel-button ghost" onClick={() => onNavigate({ name: 'full-map' })}>
              查看完整地图
            </button>
          </div>
          {settings.showHints && (
            <dl className="control-hints" aria-label="操作方式">
              <div><dt>移动</dt><dd><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></dd></div>
              <div><dt>骑行</dt><dd><KeyCap wide>Shift</KeyCap></dd></div>
              <div><dt>互动</dt><dd><KeyCap>E</KeyCap></dd></div>
            </dl>
          )}
        </div>

        <figure className="viewfinder" aria-label="校园地图取景">
          <button type="button" className="viewfinder-frame" aria-label="打开地图浏览" onClick={() => onNavigate({ name: 'map' })}>
            <img className="viewfinder-map" src="/maps/campus-final-v9.png" alt="" width="1041" height="1511" decoding="async" />
            <span className="viewfinder-sprite" style={{ filter: `hue-rotate(${character.hue}deg)` }}>
              <PixelSprite state="walk" direction="down" scale={2} label={`${character.name}正在校园里行走`} />
            </span>
            <span className="viewfinder-compass" aria-hidden="true">北▲</span>
            <span className="viewfinder-size" aria-hidden="true">1041 × 1511</span>
            <span className="viewfinder-cta" aria-hidden="true">点击进入地图</span>
          </button>
          <figcaption>最终地图 v9 · 无路线标记版</figcaption>
        </figure>
      </section>

      <section className="campus-strip" aria-label="校区一览">
        {CAMPUSES.map((campus) => {
          const interactive = campus.placeIds.length > 0;
          return (
            <article key={campus.id} className={interactive ? 'campus-card interactive' : 'campus-card'}>
              <span className="campus-index">{campus.index}</span>
              <button type="button" className="campus-card-link" onClick={() => onNavigate({ name: 'campus', campusId: campus.id })}>
                <span className="campus-plate">{campus.name}</span>
                <span className="campus-note">{campus.note}</span>
              </button>
              {interactive && (
                <div className="campus-places" aria-label={`${campus.name}可互动地点`}>
                  {campus.placeIds.map((placeId) => (
                    <button key={placeId} type="button" className="place-chip" onClick={() => onNavigate({ name: 'place', placeId })}>
                      <PixelIcon name="pin" size={10} />
                      {PLACES[placeId].identity.name}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <footer className="start-footer">
        <span className="status-dot" aria-hidden="true" />
        <span>当前版本仅支持地图浏览。角色移动、碰撞与地点交互待接入；道路与入口尚未标定。</span>
      </footer>
    </main>
  );
}
