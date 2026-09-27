import type { CharacterStatus } from '../game/CampusMapScene';
import { MAP_IMAGE_PATH, MAP_WIDTH_PX, MAP_HEIGHT_PX } from '../shared/contracts';
import type { CharacterChoice } from '../game/character/choices';
import CharacterPreview from '../game/character/CharacterPreview';
import type { CampusProfile } from './campus-profile';

interface Props {
  character: CharacterStatus | null;
  choice: CharacterChoice;
  onReturnHome: () => void;
  returnHomeDisabled?: boolean;
  profile?: CampusProfile | null;
}

export default function ExplorerSidebar({ character, choice, onReturnHome, returnHomeDisabled = false, profile = null }: Props) {
  const size = 440;
  const left = Math.max(0, Math.min(MAP_WIDTH_PX - size, (character?.x ?? MAP_WIDTH_PX / 2) - size / 2));
  const top = Math.max(0, Math.min(MAP_HEIGHT_PX - size, (character?.y ?? MAP_HEIGHT_PX / 2) - size / 2));
  return <aside className="explorer-sidebar" aria-label="校园信息">
    <div className="explorer-sidebar-content">
      <section aria-label="小地图">
        <div className="explorer-mini-heading"><h1>附近地图</h1><span>北 ↑</span></div>
        <div className="explorer-minimap">
          <svg role="img" aria-label="角色附近的校园小地图" viewBox={`${left} ${top} ${size} ${size}`}>
            <image href={MAP_IMAGE_PATH} width={MAP_WIDTH_PX} height={MAP_HEIGHT_PX} />
            {character && <circle cx={character.x} cy={character.y} r="7" fill="#ffe692" stroke="#254d3b" strokeWidth="3" />}
          </svg>
          {!character && <span className="explorer-mini-pending">角色尚未就绪</span>}
        </div>
      </section>
      <section className="explorer-student" aria-labelledby="student-title">
        <h2 id="student-title">个人信息</h2>
        <div className="explorer-student-heading">
          <div className="explorer-portrait" role="img" aria-label="当前角色头像">
            <CharacterPreview character={choice} />
          </div>
          <div className="explorer-student-name"><span>姓名</span><strong className={profile ? 'is-filled' : undefined}>{profile?.name ?? '待填写'}</strong></div>
        </div>
        <dl><div><dt>学院</dt><dd>{profile?.college ?? '待填写'}</dd></div><div><dt>学号</dt><dd>{profile?.studentId || '待填写'}</dd></div></dl>
      </section>
    </div>
    <footer className="explorer-sidebar-bottom"><button type="button" className="explorer-home" onClick={onReturnHome} disabled={returnHomeDisabled} title={returnHomeDisabled ? '请先返回校园，再返回首页' : undefined}><span aria-hidden="true">←</span><span>返回首页</span><span aria-hidden="true">↗</span></button></footer>
  </aside>;
}
