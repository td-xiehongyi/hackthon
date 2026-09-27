import { useCallback, useRef, useState } from 'react';
import type { CloseGuard, PlacePanelProps } from '@/shared/contracts';
import { campusApi } from '@/shared/api/client';
import StadiumPanel from '@/features/stadium/StadiumPanel';
import ContentEditor from '@/features/content-editor/ContentEditor';
import type { CharacterChoice } from '@/game/character/choices';

/** C 的查询与编辑界面共用宿主输入锁和 D 的真实数据客户端。 */
export default function StadiumPage(props: PlacePanelProps & { characterChoice?: CharacterChoice }) {
  const [editing, setEditing] = useState(false);
  const [hint, setHint] = useState('');
  const guard = useRef<CloseGuard | null>(null);
  const registerCloseGuard = useCallback((check: CloseGuard) => {
    guard.current = check;
    const unregister = props.registerCloseGuard(check);
    return () => { if (guard.current === check) guard.current = null; unregister(); };
  }, [props.registerCloseGuard]);
  async function closeEditor() {
    try {
      if (guard.current && !(await guard.current())) {
        setHint('请先保存或放弃未保存修改，再返回活动查询。');
        return;
      }
      setEditing(false);
      setHint('');
    } catch { setHint('关闭检查失败，已保留编辑内容。'); }
  }
  return <div className="stadium-page">
    {hint && <p role="status">{hint}</p>}
    {editing ? <>
      <ContentEditor api={campusApi} registerCloseGuard={registerCloseGuard} onRequestClose={() => void closeEditor()} />
    </> : <>
      <div className="place-actions"><button onClick={async () => {
        if (guard.current && !(await guard.current())) { setHint('请等待当前上传完成后再进入维护。'); return; }
        setHint(''); setEditing(true);
      }}>维护社团与活动</button></div>
      <StadiumPanel {...props} registerCloseGuard={registerCloseGuard} api={campusApi} />
    </>}
  </div>;
}
