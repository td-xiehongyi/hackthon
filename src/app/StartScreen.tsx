import KeyCap from '../shared/ui/KeyCap';
import PixelSprite from '../shared/ui/PixelSprite';

interface StartScreenProps {
  onEnter: () => void;
}

const CAMPUSES = [
  { index: '01', name: '岳麓山校区', note: '南门 · 图书馆 · 和平楼 · 观云池' },
  { index: '02', name: '麓南校区', note: '升华公寓 · 半月湖 · 二食堂 · 天桥' },
  { index: '03', name: '潇湘校区', note: '可互动：图书馆 · 教学楼群 · 体育场（副场）', interactive: true },
];

export default function StartScreen({ onEnter }: StartScreenProps) {
  return (
    <main className="start-screen">
      <header className="start-header">
        <div className="brand-mark" aria-hidden="true">中南</div>
        <span className="start-header-title">中南大学像素校园</span>
        <span className="version-tag">v0.1 · 本机运行</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">CSU PIXEL CAMPUS</p>
          <h1 id="hero-title" className="pixel-title" aria-label="中南大学像素校园">
            中南大学<br />像素校园
          </h1>
          <p className="hero-lead">三个校区连成一张地图。沿着校园道路探索，靠近地点，按下 E 进入互动。</p>
          <div className="hero-actions">
            <button type="button" className="pixel-button primary" onClick={onEnter}>
              <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12"><path d="M2 1h2v2H2zM4 3h2v2H4zM6 5h2v2H6zM4 7h2v2H4zM2 9h2v2H2z" fill="currentColor" /></svg>
              进入校园
            </button>
            <a className="pixel-button ghost" href="/maps/campus-final-v9.png" target="_blank" rel="noreferrer">
              查看完整地图
            </a>
          </div>
          <dl className="control-hints" aria-label="操作方式">
            <div><dt>移动</dt><dd><KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></dd></div>
            <div><dt>骑行</dt><dd><KeyCap wide>Shift</KeyCap></dd></div>
            <div><dt>互动</dt><dd><KeyCap>E</KeyCap></dd></div>
          </dl>
        </div>

        <figure className="viewfinder" aria-label="校园地图取景">
          <div className="viewfinder-frame">
            <img className="viewfinder-map" src="/maps/campus-final-v9.png" alt="" width="1041" height="1511" decoding="async" />
            <PixelSprite state="walk" direction="down" scale={2} className="viewfinder-sprite" label="占位像素角色" />
            <span className="viewfinder-compass" aria-hidden="true">北▲</span>
            <span className="viewfinder-size" aria-hidden="true">1041 × 1511</span>
          </div>
          <figcaption>最终地图 v9 · 无路线标记版</figcaption>
        </figure>
      </section>

      <section className="campus-strip" aria-label="校区一览">
        {CAMPUSES.map((campus) => (
          <div key={campus.index} className={campus.interactive ? 'campus-card interactive' : 'campus-card'}>
            <span className="campus-index">{campus.index}</span>
            <span className="campus-plate">{campus.name}</span>
            <p className="campus-note">{campus.note}</p>
          </div>
        ))}
      </section>

      <footer className="start-footer">
        <span className="status-dot" aria-hidden="true" />
        <span>当前版本仅支持地图浏览。角色移动、碰撞与地点交互待接入；道路与入口尚未标定。</span>
      </footer>
    </main>
  );
}
