/**
 * 地图场景与 React 宿主之间的唯一自定义事件通道。
 *
 * 约定（docs/02 第 5.1 节）：地图只发送 `request-open-place { placeId }`。
 * 形状校验在此完成，宿主不信任未经检查的事件负载。
 * 功能模块不得自建浏览器事件、全局变量或直接操作 Phaser 实例绕开宿主。
 */

import { REQUEST_OPEN_PLACE_EVENT, type PlaceId } from '../shared/contracts';
import { isPlaceId } from '../shared/place-registry';

export interface RequestOpenPlaceDetail {
  placeId: PlaceId;
}

export type MapRequestListener = (detail: RequestOpenPlaceDetail) => void;

/** 事件负载校验：结构不符时返回 null，不猜测地点。 */
export function parseRequestOpenPlaceDetail(detail: unknown): RequestOpenPlaceDetail | null {
  if (typeof detail !== 'object' || detail === null) return null;
  const placeId = (detail as { placeId?: unknown }).placeId;
  return isPlaceId(placeId) ? { placeId } : null;
}

/**
 * 地图端的事件发送器。场景持有它，把打开请求交给宿主。
 * 发送前的目标有效性、脚底点判定与新按下 E 的规则由场景的交互控制器负责。
 */
export function createMapRequestEmitter(
  dispatch: (detail: RequestOpenPlaceDetail) => void,
): (placeId: PlaceId) => void {
  return (placeId) => {
    const detail = parseRequestOpenPlaceDetail({ placeId });
    if (!detail) return;
    dispatch(detail);
  };
}

export { REQUEST_OPEN_PLACE_EVENT };
