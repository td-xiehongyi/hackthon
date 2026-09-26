/**
 * C（体育场副场 / 内容编辑器）本地类型副本。
 *
 * 临时：待 A 落地 `src/shared/contracts.ts` 后，改为从那里统一 import。
 * 来源：docs/contracts/campus-v1.d.ts（契约版本 1.0.0），字段与形状保持一致。
 */

export type CampusId = 'yuelushan' | 'lunan' | 'xiaoxiang';
export type PlaceId =
  | 'xiaoxiang_library'
  | 'xiaoxiang_teaching_group'
  /** 潇湘校区体育场（副场）；不含鸟巢及其他运动场。 */
  | 'xiaoxiang_sports_ground';
export type FeatureKey = 'library' | 'teaching' | 'stadium';

export type PlaceIdentity =
  | { name: string; campusId: 'xiaoxiang'; placeId: 'xiaoxiang_library'; featureKey: 'library' }
  | { name: string; campusId: 'xiaoxiang'; placeId: 'xiaoxiang_teaching_group'; featureKey: 'teaching' }
  | { name: string; campusId: 'xiaoxiang'; placeId: 'xiaoxiang_sports_ground'; featureKey: 'stadium' };

export interface Building {
  id: string;
  name: string;
  campusId: 'xiaoxiang';
  groupPlaceId: 'xiaoxiang_teaching_group';
  aliases: string[];
  landmarkId: string | null;
}

export type NavigationTarget =
  | { kind: 'place'; placeId: PlaceId }
  | { kind: 'building'; buildingId: string }
  | { kind: 'landmark'; landmarkId: string };
export type LocateResult =
  | { status: 'marked' }
  | { status: 'unmapped'; message: string }
  | { status: 'unknown-target'; message: string };
export type CloseGuard = () => boolean | Promise<boolean>;

export interface PlacePanelProps {
  place: PlaceIdentity;
  sessionId: string;
  buildings: readonly Building[];
  onRequestClose: () => void;
  onLocate: (target: NavigationTarget) => Promise<LocateResult>;
  registerCloseGuard: (guard: CloseGuard) => () => void;
}

// —— 公共内容（社团与活动） ——
export interface PublicLink {
  label: string;
  url: string;
}
export interface Club {
  id: string;
  name: string;
  category: string;
  summary: string;
  campusIds: CampusId[];
  links: PublicLink[];
}
export interface Activity {
  id: string;
  name: string;
  organizerClubId: string;
  category: string;
  /** RFC 3339（带偏移或 Z）。展示/筛选时区固定为 Asia/Shanghai。 */
  startsAt: string;
  endsAt: string;
  campusId: CampusId | null;
  /** 实际活动地点，必须单独展示，不能统一归为操场。 */
  venue: string;
  description: string;
  links: PublicLink[];
}
export interface PublicContent {
  clubs: Club[];
  activities: Activity[];
}
export interface PublicContentSnapshot extends PublicContent {
  schemaVersion: 1;
  revision: number;
}
export interface SavePublicContentRequest {
  expectedRevision: number;
  content: PublicContent;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: { path: string; message: string }[];
  };
}

export interface PublicContentApi {
  read(): Promise<PublicContentSnapshot>;
  save(request: SavePublicContentRequest): Promise<PublicContentSnapshot>;
}
