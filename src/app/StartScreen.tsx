import { useRef } from 'react';
import { MAP_IMAGE_PATH } from '../shared/contracts';
import { CHARACTER_CHOICES, type CharacterChoice } from '../game/character/choices';
import CharacterPreview from '../game/character/CharacterPreview';
import StartTools from './StartTools';
import type { CampusProfile } from './campus-profile';
import './start-screen.css';

interface Props {
  character: CharacterChoice;
  onSelect: (character: CharacterChoice) => void;
  onEnter: () => void;
  profile: CampusProfile | null;
  onProfileChange: (profile: CampusProfile | null) => void;
}

export default function StartScreen({ character, onSelect, onEnter, profile, onProfileChange }: Props) {
  const mapDialog = useRef<HTMLDialogElement>(null);
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
          <StartTools profile={profile} onProfileChange={onProfileChange} />
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
            <div className="start-character-name" aria-live="polite"><strong>{character.name}</strong></div>
            <div className="start-character-options" role="group" aria-label="可选角色">
              {CHARACTER_CHOICES.map(choice => (
                <button type="button" key={choice.id} aria-label={`选择${choice.name}`} aria-pressed={choice.id === character.id} onClick={() => onSelect(choice)}>
                  <CharacterPreview character={choice} /><span>{choice.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="start-intro">
            <h1 aria-label="中南大学像素校园">中南大学<br />像素校园</h1>
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

      </div>

      <dialog ref={mapDialog} className="start-dialog start-map-dialog" aria-labelledby="full-map-title">
        <header><h2 id="full-map-title">完整校园地图</h2><button type="button" aria-label="关闭完整地图" onClick={() => mapDialog.current?.close()}>×</button></header>
        <div className="start-full-map"><img src={MAP_IMAGE_PATH} alt="中南大学完整校园地图" /></div>
      </dialog>
    </main>
  );
}
