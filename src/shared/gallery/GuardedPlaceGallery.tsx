import { useEffect, useState } from 'react';
import type { PlacePanelProps } from '../contracts';
import PlaceGallery from './PlaceGallery';

export default function GuardedPlaceGallery({ place, registerCloseGuard }: Pick<PlacePanelProps, 'place' | 'registerCloseGuard'>) {
  const [uploading, setUploading] = useState(false);
  useEffect(() => uploading ? registerCloseGuard(() => false) : undefined, [uploading, registerCloseGuard]);
  return <PlaceGallery placeId={place.placeId} onActivityChange={setUploading} />;
}
