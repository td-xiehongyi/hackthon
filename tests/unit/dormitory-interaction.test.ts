import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { MapAnnotation } from '@/shared/contracts';
import { activeInteractions, selectTarget } from '@/game/interaction/interaction';
import { DEV_TUNING, footprintFits } from '@/game/movement/movement';
import { validateAnnotation } from '@/game/map-data';

test('升华公寓西侧道路可站立，靠近选中宿舍，离开撤下提示', () => {
  const annotation = JSON.parse(readFileSync('public/maps/campus-v20.annotations.json', 'utf8')) as MapAnnotation;
  expect(validateAnnotation(annotation)).toEqual([]);
  const entrance = { x: 342, y: 615 };
  expect(footprintFits(entrance, DEV_TUNING.rideFootprint, annotation)).toBe(true);
  const interactions = activeInteractions(annotation.interactions);
  expect(selectTarget(entrance, interactions)).toBe('lunan_shenghua_dormitory');
  expect(selectTarget({ x: 300, y: 615 }, interactions)).toBeNull();
  const dorm = annotation.interactions.find(item => item.placeId === 'lunan_shenghua_dormitory');
  expect(dorm?.highlightPolygon?.length).toBeGreaterThanOrEqual(4);
});
