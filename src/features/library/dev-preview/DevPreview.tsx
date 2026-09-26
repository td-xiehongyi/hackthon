import { useState } from 'react';
import type { LocateResult, NavigationTarget, PlaceId, PlaceIdentity } from '../../../shared/contracts';
import LibraryPanel from '../LibraryPanel';
import PlaceGallery from '../../../shared/gallery/PlaceGallery';

const PLACES: PlaceIdentity[] = [
  { name: '潇湘校区图书馆', campusId: 'xiaoxiang', placeId: 'xiaoxiang_library', featureKey: 'library' },
  { name: '潇湘校区教学楼群', campusId: 'xiaoxiang', placeId: 'xiaoxiang_teaching_group', featureKey: 'teaching' },
  { name: '潇湘校区体育场（副场）', campusId: 'xiaoxiang', placeId: 'xiaoxiang_sports_ground', featureKey: 'stadium' },
];

export default function DevPreview() {
  const [placeId, setPlaceId] = useState<PlaceId>('xiaoxiang_library');
  const place = PLACES.find((p) => p.placeId === placeId) ?? PLACES[0];

  const registerCloseGuard = () => () => {};
  const onLocate = async (_target: NavigationTarget): Promise<LocateResult> => ({
    status: 'unmapped',
    message: '预览模式：未接入地图',
  });
  const onRequestClose = () => window.alert('预览模式：返回校园由宿主（A）实现');

  return (
    <main className="dev-preview">
      <div className="dev-preview-toolbar">
        <label>
          选择地点{' '}
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value as PlaceId)}>
            {PLACES.map((p) => (
              <option key={p.placeId} value={p.placeId}>{p.name}</option>
            ))}
          </select>
        </label>
        <span>开发预览（D 线）· 非正式入口</span>
      </div>

      {place.featureKey === 'library' ? (
        <LibraryPanel
          place={place}
          sessionId="dev-preview"
          buildings={[]}
          onRequestClose={onRequestClose}
          onLocate={onLocate}
          registerCloseGuard={registerCloseGuard}
        />
      ) : (
        <section className="dev-gallery-host">
          <h1>{place.name}</h1>
          <PlaceGallery placeId={place.placeId} />
        </section>
      )}
    </main>
  );
}
