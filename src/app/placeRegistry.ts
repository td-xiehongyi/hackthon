import type { ComponentType, LazyExoticComponent } from 'react';
import type { FeatureKey, PlacePanelProps } from '../shared/contracts';

/**
 * 地点功能页注册表（A 独占）。
 * B/C/D 交付组件后，把对应 featureKey 的 loader 指向 src/features/<key>/ 下的默认导出即可，
 * 宿主 PlacePage 不需要改动。未接入的 key 返回 null，由宿主渲染占位页。
 */
export type PlacePanel = ComponentType<PlacePanelProps> | LazyExoticComponent<ComponentType<PlacePanelProps>>;

const PANELS: Partial<Record<FeatureKey, PlacePanel>> = {
  // library: lazy(() => import('../features/library/LibraryPanel')),
  // teaching: lazy(() => import('../features/teaching/TeachingPanel')),
  // stadium: lazy(() => import('../features/stadium/StadiumPanel')),
};

export function resolvePanel(featureKey: FeatureKey): PlacePanel | null {
  return PANELS[featureKey] ?? null;
}
