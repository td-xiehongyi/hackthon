import type { CharacterChoice } from './choices';

export default function CharacterPreview({ character, size = 'small' }: { character: CharacterChoice; size?: 'small' | 'large' }) {
  const { preview } = character;
  const scale = Math.min((size === 'large' ? 112 : 40) / preview.width, (size === 'large' ? 128 : 44) / preview.height);
  return <span className="character-preview" aria-hidden="true" style={{
    width: preview.width * scale,
    height: preview.height * scale,
    backgroundImage: `url('${character.dir}/${preview.sheet}')`,
    backgroundSize: `${preview.sheetWidth * scale}px ${preview.sheetHeight * scale}px`,
    backgroundPosition: `-${preview.x * scale}px -${preview.y * scale}px`,
    filter: character.hue ? `hue-rotate(${character.hue}deg)` : undefined,
  }} />;
}
