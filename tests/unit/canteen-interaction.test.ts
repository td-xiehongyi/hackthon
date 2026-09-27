import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { MapAnnotation } from '@/shared/contracts';
import { getPlace } from '@/shared/place-registry';
import { activeInteractions, selectTarget } from '@/game/interaction/interaction';
import { DEV_TUNING, footprintFits } from '@/game/movement/movement';
import { validateAnnotation } from '@/game/map-data';

test('二食堂南侧可站立并触发麓南食堂，离开后撤下交互', () => {
  const annotation = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8')) as MapAnnotation;
  expect(getPlace('lunan_canteen_2')).toMatchObject({ featureKey: 'canteen', campusId: 'lunan' });
  expect(validateAnnotation(annotation)).toEqual([]);
  const interactions = activeInteractions(annotation.interactions);
  const entrance = { x: 560, y: 748 };
  expect(footprintFits(entrance, DEV_TUNING.rideFootprint, annotation)).toBe(true);
  expect(selectTarget(entrance, interactions)).toBe('lunan_canteen_2');
  expect(selectTarget({ x: 560, y: 800 }, interactions)).toBeNull();
});
