/**
 * 共享契约运行时落地。
 *
 * 唯一运行时类型来源：内容与 `docs/contracts/campus-v1.d.ts`（契约版本 1.0.0）保持一致。
 * 文档中的声明是协议参考，此处不得另立一套字段，也不允许两个运行时类型文件各自演进。
 * 契约发生不兼容变更时，先同步文档、此文件与全部调用方，再改动实现。
 */

export const CONTRACT_VERSION = '1.0.0' as const;
export type ContractVersion = typeof CONTRACT_VERSION;

/** 地图标注契约固定值。 */
export const MAP_ID = 'csu-campus-v20' as const;
export const COORDINATE_SYSTEM = 'image-pixels-top-left' as const;
export const MAP_WIDTH_PX = 1041 as const;
export const MAP_HEIGHT_PX = 1511 as const;
export const MAP_IMAGE_PATH = '/maps/campus-v20.png' as const;
export const MAP_IMAGE_SHA256 =
  '2502f84dbbc3d15940ac42c7d07a7e3b319bb1804c71a955cc95b61306f0f410' as const;

/** 场景向宿主请求打开地点功能页的唯一自定义事件名。 */
export const REQUEST_OPEN_PLACE_EVENT = 'request-open-place' as const;

export type CampusId = 'yuelushan' | 'lunan' | 'xiaoxiang';
export type PlaceId =
  | 'xiaoxiang_library'
  | 'xiaoxiang_teaching_group'
  /** 仅潇湘校区体育场（副场）；不含体育场（鸟巢）及其他运动场。 */
  | 'xiaoxiang_sports_ground'
  | 'lunan_canteen_2';
export type FeatureKey = 'library' | 'teaching' | 'stadium' | 'canteen';
export type PlaceIdentity = { name: string } & (
  | { placeId: 'xiaoxiang_library'; featureKey: 'library'; campusId: 'xiaoxiang' }
  | { placeId: 'xiaoxiang_teaching_group'; featureKey: 'teaching'; campusId: 'xiaoxiang' }
  | { placeId: 'xiaoxiang_sports_ground'; featureKey: 'stadium'; campusId: 'xiaoxiang' }
  | { placeId: 'lunan_canteen_2'; featureKey: 'canteen'; campusId: 'lunan' }
);

export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
/** 原图像素坐标。至少三个不同顶点；不重复首顶点。 */
export type Polygon = Point[];
export type VerificationStatus = 'pending' | 'verified';
export interface PolygonArea { id: string; polygon: Polygon }
export interface CollisionArea extends PolygonArea { reason: string }
export interface Landmark {
  id: string;
  name: string;
  campusId: CampusId;
  anchor: Point | null;
  verificationStatus: VerificationStatus;
}
export interface Building {
  id: string;
  name: string;
  campusId: 'xiaoxiang';
  groupPlaceId: 'xiaoxiang_teaching_group';
  aliases: string[];
  landmarkId: string | null;
}
export interface InteractionRecord {
  placeId: PlaceId;
  verificationStatus: VerificationStatus;
  /** 地图/目标定位参考点；角色不必站到该点。 */
  entrancePoint: Point | null;
  /** 新按下 E 时，角色脚底点必须处于该区域内。 */
  triggerPolygon: Polygon | null;
  /** 建筑/场地轮廓，仅用于高亮；省略时沿用触发范围。 */
  highlightPolygon?: Polygon;
  returnFallbackPointId: string | null;
}
export interface SafePoint {
  id: string;
  position: Point;
  usage: ('spawn' | 'teleport' | 'return')[];
  verificationStatus: VerificationStatus;
}
export interface Occluder {
  id: string;
  imagePath: string;
  rect: Rect;
  depthAnchorY: number;
  verificationStatus: VerificationStatus;
}
export interface MapAnnotation {
  schemaVersion: 1;
  mapId: typeof MAP_ID;
  imagePath: string;
  imageSha256: string;
  widthPx: typeof MAP_WIDTH_PX;
  heightPx: typeof MAP_HEIGHT_PX;
  coordinateSystem: typeof COORDINATE_SYSTEM;
  annotationStatus: VerificationStatus;
  geographyStatus: VerificationStatus;
  walkableAreas: PolygonArea[];
  collisionAreas: CollisionArea[];
  landmarks: Landmark[];
  buildings: Building[];
  interactions: InteractionRecord[];
  safePoints: SafePoint[];
  occluders: Occluder[];
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export type MovementMode = 'walk' | 'ride';
export type CharacterAction = 'idle' | 'move';
export interface PlaceSession {
  sessionId: string;
  placeId: PlaceId;
  mapId: MapAnnotation['mapId'];
  entryPosition: Point;
  facing: Direction;
}
export interface CampusEventMap {
  /** 在有效触发范围内新按下 E 时，请求打开地点功能页。 */
  'request-open-place': { placeId: PlaceId };
}
export type NavigationTarget =
  | { kind: 'place'; placeId: PlaceId }
  | { kind: 'building'; buildingId: string }
  | { kind: 'landmark'; landmarkId: string };
export type LocateResult =
  | { status: 'marked' }
  | { status: 'unmapped'; message: string }
  | { status: 'unknown-target'; message: string };
/** 返回 true 允许关闭；返回 false 或拒绝时保留功能页与输入锁。 */
export type CloseGuard = () => boolean | Promise<boolean>;
export interface PlacePanelProps {
  place: PlaceIdentity;
  sessionId: string;
  buildings: readonly Building[];
  onRequestClose: () => void;
  onLocate: (target: NavigationTarget) => Promise<LocateResult>;
  registerCloseGuard: (guard: CloseGuard) => () => void;
}
export interface GalleryProps { placeId: PlaceId }

export interface PublicLink { label: string; url: string }
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
  /** RFC 3339，带时区偏移。业务展示与筛选时区固定为 Asia/Shanghai。 */
  startsAt: string;
  endsAt: string;
  campusId: CampusId | null;
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
export interface PhotoMeta {
  id: string;
  placeId: PlaceId;
  mediaType: string;
  byteSize: number;
  createdAt: string;
  fileUrl: string;
  uploadRequestId: string;
}
export interface PhotoList { placeId: PlaceId; photos: PhotoMeta[] }
export type ImagePolicy =
  | { status: 'pending' }
  | {
      status: 'configured';
      acceptedMimeTypes: string[];
      maxFileBytes: number;
      /** null 表示明确不设该项上限，不表示未知。 */
      maxAlbumBytes: number | null;
      maxAlbumCount: number | null;
    };
export interface Capabilities {
  apiVersion: 'v1';
  contractVersion: ContractVersion;
  placeIds: PlaceId[];
  imagePolicy: ImagePolicy;
  features: {
    photoUpload: 'single';
    photoDelete: false;
    photoCaption: false;
    photoReorder: false;
  };
}
export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: { path: string; message: string }[];
  };
}
export interface GalleryApi {
  list(placeId: PlaceId): Promise<PhotoList>;
  upload(placeId: PlaceId, file: File, uploadRequestId: string): Promise<PhotoMeta>;
}
export interface PublicContentApi {
  read(): Promise<PublicContentSnapshot>;
  save(request: SavePublicContentRequest): Promise<PublicContentSnapshot>;
}

export interface SpriteSheet {
  id: string;
  /** 相对 manifest 所在目录，不是操作系统路径或外站 URL。 */
  url: string;
  width: number;
  height: number;
}
export interface SpriteFrame {
  sheetId: string;
  rect: Rect;
  /** 帧内局部像素。世界落地点保持不变。 */
  anchor: Point;
  durationMs: number;
}
export interface CharacterClip {
  mode: MovementMode;
  facing: Direction;
  action: CharacterAction;
  loop: boolean;
  frames: SpriteFrame[];
}
export interface CharacterManifest {
  schemaVersion: 1;
  characterId: string;
  sheets: SpriteSheet[];
  clips: CharacterClip[];
}
