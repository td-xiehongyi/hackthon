/** Campus contract 1.0.0. Declaration only: no application or server implementation. */
export type ContractVersion = "1.0.0";
export type CampusId = "yuelushan" | "lunan" | "xiaoxiang";
export type PlaceId =
  | "xiaoxiang_library"
  | "xiaoxiang_teaching_group"
  /** Xiaoxiang secondary stadium only; excludes the main stadium and other fields. */
  | "xiaoxiang_sports_ground";
export type FeatureKey = "library" | "teaching" | "stadium";
export type PlaceIdentity = { name: string; campusId: "xiaoxiang" } & (
  | { placeId: "xiaoxiang_library"; featureKey: "library" }
  | { placeId: "xiaoxiang_teaching_group"; featureKey: "teaching" }
  | { placeId: "xiaoxiang_sports_ground"; featureKey: "stadium" }
);

export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
/** Source-image pixels. At least three distinct vertices; do not repeat the first. */
export type Polygon = Point[];
export type VerificationStatus = "pending" | "verified";
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
  campusId: "xiaoxiang";
  groupPlaceId: "xiaoxiang_teaching_group";
  aliases: string[];
  landmarkId: string | null;
}
export interface InteractionRecord {
  placeId: PlaceId;
  verificationStatus: VerificationStatus;
  /** Map/target reference point; the player need not stand at this exact point. */
  entrancePoint: Point | null;
  /** Player ground-contact point must be inside this area when E is newly pressed. */
  triggerPolygon: Polygon | null;
  /** Optional building/ground outline for highlighting; defaults to the trigger area. */
  highlightPolygon?: Polygon;
  returnFallbackPointId: string | null;
}
export interface SafePoint {
  id: string;
  position: Point;
  usage: ("spawn" | "teleport" | "return")[];
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
  mapId: "csu-campus-v20";
  imagePath: string;
  imageSha256: string;
  widthPx: 1041;
  heightPx: 1511;
  coordinateSystem: "image-pixels-top-left";
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

export type Direction = "up" | "down" | "left" | "right";
export type MovementMode = "walk" | "ride";
export type CharacterAction = "idle" | "move";
export interface PlaceSession {
  sessionId: string;
  placeId: PlaceId;
  mapId: MapAnnotation["mapId"];
  entryPosition: Point;
  facing: Direction;
}
export interface CampusEventMap {
  /** Requests a place page from a new E press within the active trigger area. */
  "request-open-place": { placeId: PlaceId };
}
export type NavigationTarget =
  | { kind: "place"; placeId: PlaceId }
  | { kind: "building"; buildingId: string }
  | { kind: "landmark"; landmarkId: string };
export type LocateResult =
  | { status: "marked" }
  | { status: "unmapped"; message: string }
  | { status: "unknown-target"; message: string };
/** true allows closing; false or rejection keeps the panel and input lock. */
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
  /** RFC 3339, with offset. Business display/filter timezone: Asia/Shanghai. */
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
  | { status: "pending" }
  | {
      status: "configured";
      acceptedMimeTypes: string[];
      maxFileBytes: number;
      /** null means explicitly unlimited, never unconfirmed. */
      maxAlbumBytes: number | null;
      maxAlbumCount: number | null;
    };
export interface Capabilities {
  apiVersion: "v1";
  contractVersion: ContractVersion;
  placeIds: PlaceId[];
  imagePolicy: ImagePolicy;
  features: {
    photoUpload: "single";
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
  /** Relative to the manifest directory, not an OS path or remote URL. */
  url: string;
  width: number;
  height: number;
}
export interface SpriteFrame {
  sheetId: string;
  rect: Rect;
  /** Frame-local pixels. The world ground-contact point stays invariant. */
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
