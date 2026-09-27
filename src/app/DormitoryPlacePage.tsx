import type { PlacePanelProps } from '@/shared/contracts';
import DormitoryPage from '@/features/dormitory/DormitoryPage';
import GuardedPlaceGallery from '@/shared/gallery/GuardedPlaceGallery';

export default function DormitoryPlacePage(props: PlacePanelProps) {
  return <section className="dormitory-place" aria-label={props.place.name}>
    <DormitoryPage onBack={props.onRequestClose} gallery={<GuardedPlaceGallery place={props.place} registerCloseGuard={props.registerCloseGuard} />} />
  </section>;
}
