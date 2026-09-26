import { useCallback, useEffect, useState } from 'react';
import type { CampusId, PlaceId } from '../shared/contracts';

/**
 * 应用内视图切换。用 URL hash 记录当前视图，浏览器前进/后退可用；
 * 不引入路由库，地图会话仍由各页面自行挂载/卸载。
 */
export type Route =
  | { name: 'start' }
  | { name: 'map' }
  | { name: 'full-map' }
  | { name: 'campus'; campusId: CampusId }
  | { name: 'place'; placeId: PlaceId };

const CAMPUS_IDS: readonly string[] = ['yuelushan', 'lunan', 'xiaoxiang'];
const PLACE_IDS: readonly string[] = ['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground'];

export const START: Route = { name: 'start' };

export function toHash(route: Route): string {
  switch (route.name) {
    case 'start': return '#/';
    case 'map': return '#/map';
    case 'full-map': return '#/map/full';
    case 'campus': return `#/campus/${route.campusId}`;
    case 'place': return `#/place/${route.placeId}`;
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return START;
  if (parts[0] === 'map') return parts[1] === 'full' ? { name: 'full-map' } : { name: 'map' };
  if (parts[0] === 'campus' && CAMPUS_IDS.includes(parts[1])) return { name: 'campus', campusId: parts[1] as CampusId };
  if (parts[0] === 'place' && PLACE_IDS.includes(parts[1])) return { name: 'place', placeId: parts[1] as PlaceId };
  return START;
}

export function sameRoute(a: Route, b: Route): boolean {
  return toHash(a) === toHash(b);
}

interface HistoryState { depth: number }

function depth(): number {
  const state = history.state as HistoryState | null;
  return typeof state?.depth === 'number' ? state.depth : 0;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

  useEffect(() => {
    const sync = () => setRoute(parseHash(location.hash));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((next: Route) => {
    if (sameRoute(next, parseHash(location.hash))) return;
    history.pushState({ depth: depth() + 1 } satisfies HistoryState, '', toHash(next));
    setRoute(next);
  }, []);

  /** 有应用内历史就后退，否则回到指定页（默认首页），避免退出到站外。 */
  const back = useCallback((fallback: Route = START) => {
    if (depth() > 0) history.back();
    else {
      history.replaceState({ depth: 0 } satisfies HistoryState, '', toHash(fallback));
      setRoute(fallback);
    }
  }, []);

  return { route, navigate, back };
}
