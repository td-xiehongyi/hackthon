import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '@/shared/contracts';
import TeachingPage from '@/features/teaching/TeachingPage';
import PlaceGallery from '@/shared/gallery/PlaceGallery';

/** 地图 E 键入口复用课表与蹭课页面，通过宿主恢复原位置。 */
export default function TeachingPlacePage({ place, onRequestClose, onLocate, registerCloseGuard }: PlacePanelProps) {
  const [uploading, setUploading] = useState(false);
  useEffect(() => uploading ? registerCloseGuard(() => false) : undefined, [uploading, registerCloseGuard]);
  return <section aria-label={place.name}>
    <TeachingPage onBack={onRequestClose} gallery={<PlaceGallery placeId={place.placeId} onActivityChange={setUploading} />} />
    <button type="button" onClick={() => void onLocate({ kind: 'place', placeId: place.placeId })}>定位本地点</button>
  </section>;
}
