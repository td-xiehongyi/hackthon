import { useState } from 'react';
import PixelIcon from '../shared/ui/PixelIcon';
import PixelSprite, { type Direction } from '../shared/ui/PixelSprite';
import { CHARACTERS, type CharacterOption } from './characters';

interface CharacterPanelProps {
  character: CharacterOption;
  onSelect: (id: string) => void;
}

const TURN: Direction[] = ['down', 'right', 'up', 'left'];

/** 左侧角色选择：大预览 + 转向 + 头像列表。 */
export default function CharacterPanel({ character, onSelect }: CharacterPanelProps) {
  const [facing, setFacing] = useState(0);
  const direction = TURN[facing];
  const rotate = (delta: number) => setFacing((cur) => (cur + delta + TURN.length) % TURN.length);
  const hueStyle = { filter: `hue-rotate(${character.hue}deg)` };

  return (
    <aside className="character-panel" aria-labelledby="character-title">
      <div className="panel-head">
        <span className="section-number">02 / CHARACTER</span>
        <h2 id="character-title" className="panel-title">选择角色</h2>
      </div>

      <div className="character-stage">
        <button type="button" className="turn-button" aria-label="向左转" onClick={() => rotate(-1)}>
          <PixelIcon name="arrow-left" />
        </button>
        <div className="character-preview" style={hueStyle}>
          <PixelSprite state="idle" direction={direction} scale={6} label={`${character.name}，面向${DIRECTION_LABEL[direction]}`} />
          <span className="character-shadow" aria-hidden="true" />
        </div>
        <button type="button" className="turn-button" aria-label="向右转" onClick={() => rotate(1)}>
          <PixelIcon name="arrow-right" />
        </button>
      </div>

      <div className="character-name">
        <span className="campus-plate">{character.name}</span>
        <span className="character-note">{character.note}</span>
      </div>

      <div className="character-grid" role="radiogroup" aria-label="角色列表">
        {CHARACTERS.map((option) => {
          const selected = option.id === character.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.available ? option.name : `${option.name}（${option.note}）`}
              title={option.available ? option.name : option.note}
              className={['character-slot', selected ? 'selected' : '', option.available ? '' : 'locked'].join(' ').trim()}
              disabled={!option.available}
              onClick={() => onSelect(option.id)}
            >
              {option.available ? (
                <span style={{ filter: `hue-rotate(${option.hue}deg)` }}>
                  <PixelSprite state="idle" direction="down" scale={2} />
                </span>
              ) : (
                <PixelIcon name="lock" size={16} />
              )}
              <span className="slot-name">{option.name}</span>
            </button>
          );
        })}
      </div>

      <p className="field-note">占位造型来自角色原型分支；正式角色素材接入后替换。</p>
    </aside>
  );
}

const DIRECTION_LABEL: Record<Direction, string> = {
  down: '前', down_right: '右前', right: '右', up_right: '右后', up: '后', up_left: '左后', left: '左', down_left: '左前',
};
