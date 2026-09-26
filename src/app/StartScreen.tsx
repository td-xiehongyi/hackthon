import { useRef } from 'react';
import { MAP_IMAGE_PATH } from '../shared/contracts';
import { CHARACTER_CHOICES, type CharacterChoice } from '../game/character/choices';
import CharacterPreview from '../game/character/CharacterPreview';
import catPreview from '../../assets/characters/photo-point-cat/e1/character-views-v2.png';
import './start-screen.css';

interface Props {
  character: CharacterChoice;
  onSelect: (character: CharacterChoice) => void;
  onEnter: () => void;
}

export default function StartScreen({ character, onSelect, onEnter }: Props) {
  const mapDialog = useRef<HTMLDialogElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  function cycle(direction: number) {
    const index = CHARACTER_CHOICES.findIndex(choice => choice.id === character.id);
    onSelect(CHARACTER_CHOICES[(index + direction + CHARACTER_CHOICES.length) % CHARACTER_CHOICES.length]);
  }
  const openMap = () => mapDialog.current?.showModal();

  return (
    <main className="start-screen">
      <div className="start-shell">
        <header className="start-header">
          <div className="brand-mark" aria-hidden="true">中南</div>
          <strong>中南大学像素校园</strong>
          <span className="start-version">v0.1 · 本机运行</span>
          <div className="start-tools">
            <button type="button" aria-label="操作说明" onClick={() => helpDialog.current?.showModal()}>?</button>
            <button type="button" aria-label="打开校园全图" onClick={openMap}>▦</button>
          </div>
        </header>

        <div className="start-layout">
          <section className="start-character" aria-labelledby="character-heading">
            <span className="start-kicker">02 / CHARACTER</span>
            <h2 id="character-heading">选择角色</h2>
            <div className="start-character-stage">
              <button type="button" aria-label="上一个角色" onClick={() => cycle(-1)}>‹</button>
              <CharacterPreview character={character} size="large" />
              <button type="button" aria-label="下一个角色" onClick={() => cycle(1)}>›</button>
            </div>
            <div className="start-character-name" aria-live="polite"><strong>{character.name}</strong><span>{character.note}</span></div>
            <div className="start-character-options" role="group" aria-label="可选角色">
              {CHARACTER_CHOICES.map(choice => (
                <button type="button" key={choice.id} aria-label={`选择${choice.name}`} aria-pressed={choice.id === character.id} onClick={() => onSelect(choice)}>
                  <CharacterPreview character={choice} /><span>{choice.name}</span>
                </button>
              ))}
              <div className="start-character-pending" aria-label="照片蓝眼长毛猫，外观审阅中，暂不能进入校园">
                <span className="start-cat-preview" style={{ backgroundImage: `url('${catPreview}')` }} aria-hidden="true" />
                <span>照片蓝眼长毛猫</span><small>外观审阅中</small>
              </div>
            </div>
            <p className="start-character-note">三位人物为待验收的动画候选，可进入校园试走。猫目前仅有外观图，暂不能进入地图。</p>
          </section>

          <section className="start-intro">
            <p className="start-kicker">CSU PIXEL CAMPUS</p>
            <h1 aria-label="中南大学像素校园">中南大学<br />像素校园</h1>
            <p className="start-description">三个校区连成一张地图。沿着校园道路探索，靠近地点，按下 E 进入互动。</p>
            <div className="start-actions">
              <button type="button" className="start-enter" onClick={onEnter}><span aria-hidden="true">›</span> 进入校园</button>
              <button type="button" onClick={openMap}>查看完整地图</button>
            </div>
            <div className="start-controls" aria-label="操作快捷键">
              <span>移动</span><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
              <span>骑行</span><kbd>Shift</kbd>
              <span>互动</span><kbd>E</kbd>
            </div>
          </section>

          <figure className="start-map">
            <button type="button" className="start-map-image" aria-label="放大校园地图预览" onClick={openMap}>
              <img src={MAP_IMAGE_PATH} alt="中南大学三个校区的像素地图预览" />
              <span className="start-north">北 ▲</span><span className="start-map-tag">CSU / CAMPUS MAP</span>
            </button>
            <figcaption>沿着熟悉的路，发现不一样的校园。 ↗</figcaption>
          </figure>
        </div>

        <section className="start-campuses" aria-label="三个校区">
          <article><span>01</span><h2>岳麓山校区</h2><p>南门 · 图书馆 · 和平楼 · 观云池</p></article>
          <article><span>02</span><h2>麓南校区</h2><p>升华公寓 · 半月湖 · 二食堂 · 天桥</p></article>
          <article><span>03</span><h2>潇湘校区</h2><p>可互动：图书馆 · 教学楼群 · 体育场（副场）</p></article>
        </section>
        <footer className="start-footer"><span><i /> 校园漫游，从这里开始。</span><span>WASD 移动 · SHIFT 骑行 · E 互动</span></footer>
      </div>

      <dialog ref={mapDialog} className="start-dialog start-map-dialog" aria-labelledby="full-map-title">
        <header><h2 id="full-map-title">完整校园地图</h2><button type="button" aria-label="关闭完整地图" onClick={() => mapDialog.current?.close()}>×</button></header>
        <div className="start-full-map"><img src={MAP_IMAGE_PATH} alt="中南大学完整校园地图" /></div>
      </dialog>
      <dialog ref={helpDialog} className="start-dialog" aria-labelledby="start-help-title">
        <header><h2 id="start-help-title">操作说明</h2><button type="button" aria-label="关闭操作说明" onClick={() => helpDialog.current?.close()}>×</button></header>
        <p>先选择角色，再点击「进入校园」。</p><p>W / A / S / D 移动，按住 Shift 骑行。</p><p>靠近可互动建筑，建筑高亮后按 E 进入。</p><p>进入校园后，可切换「浏览」模式拖动和缩放地图。</p>
      </dialog>
    </main>
  );
}
