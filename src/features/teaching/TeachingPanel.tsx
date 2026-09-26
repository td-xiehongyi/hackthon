import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../../shared/contracts';
import PlaceGallery from '../../shared/gallery/PlaceGallery';
import TimetableEditor from './TimetableEditor';
import './teaching.css';

export default function TeachingPanel({
  place,
  buildings,
  onRequestClose,
  registerCloseGuard,
}: PlacePanelProps) {
  const [busy, setBusy] = useState(false);
  const [timetableDirty, setTimetableDirty] = useState(false);

  useEffect(() => {
    if (!busy && !timetableDirty) return;
    return registerCloseGuard(() => !busy && !timetableDirty);
  }, [busy, registerCloseGuard, timetableDirty]);

  return (
    <section className="teaching-panel" aria-label={place.name}>
      <header className="teaching-header">
        <div><span className="teaching-eyebrow">教学楼群 · STUDY</span><h1>{place.name}</h1><p>个人课表与学习安排</p></div>
        <button type="button" onClick={onRequestClose}>返回校园</button>
      </header>
      <p className="teaching-note">课表只保存在当前浏览器。楼座目录尚未核验的课程会保留原始地点文字，不会被静默丢弃。</p>
      <TimetableEditor buildings={buildings} onDirtyChange={setTimetableDirty} />
      <PlaceGallery placeId="xiaoxiang_teaching_group" onActivityChange={setBusy} />
    </section>
  );
}
