/**
 * Snapshot data decoded from the ten QR-code photographs supplied for the
 * teaching-building parking/charging area.
 *
 * This is deliberately kept separate from the view.  A future status adapter
 * can replace `status` and `remainingSeconds` without changing the QR payload
 * or the order in which the buttons are presented.
 */

export type ParkingPortStatus = 'available' | 'occupied';

export interface ParkingPort {
  /** Display order from the photographs (1–10). */
  order: number;
  /** Full DeviceNumber from the QR payload. */
  id: string;
  status: ParkingPortStatus;
  /** Snapshot/demo remaining duration, in seconds. */
  remainingSeconds: number;
  /** Complete text decoded from the QR code. */
  payload: string;
  /** Human-readable recognition result, useful when auditing the photos. */
  payloadStatus: string;
  /** The source image label supplied with the QR-code attachment. */
  photo: string;
  source: string;
}

const QR_ENDPOINT = 'http://semiot.wasion.cn';
const QR_ADMIN = '威胜集团';

const payloadFor = (deviceNumber: string) =>
  `${QR_ENDPOINT}?AdminName=${QR_ADMIN}&DeviceNumber=${deviceNumber}`;

const photoSource = (filename: string) => filename;

/**
 * The order and values below mirror the attached images.  Status and duration
 * are a photo-time demonstration snapshot, not a claim about live occupancy.
 */
export const PARKING_PORTS: readonly ParkingPort[] = [
  {
    order: 1,
    id: '120000032056',
    status: 'occupied',
    remainingSeconds: 1 * 3600 + 42 * 60 + 18,
    payload: payloadFor('120000032056'),
    payloadStatus: '已识别',
    photo: '图片 01',
    source: photoSource('Weixin Image_20260926220546_17_16.jpg'),
  },
  {
    order: 2,
    id: '120000040680',
    status: 'occupied',
    remainingSeconds: 28 * 60 + 46,
    payload: payloadFor('120000040680'),
    payloadStatus: '已识别',
    photo: '图片 02',
    source: photoSource('Weixin Image_20260926220546_18_16.jpg'),
  },
  {
    order: 3,
    id: '120000040145',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000040145'),
    payloadStatus: '已识别',
    photo: '图片 03',
    source: photoSource('Weixin Image_20260926220547_19_16.jpg'),
  },
  {
    order: 4,
    id: '120000040056',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000040056'),
    payloadStatus: '已识别',
    photo: '图片 04',
    source: photoSource('Weixin Image_20260926220548_20_16.jpg'),
  },
  {
    order: 5,
    id: '120000040770',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000040770'),
    payloadStatus: '已识别',
    photo: '图片 05',
    source: photoSource('Weixin Image_20260926220549_21_16.jpg'),
  },
  {
    order: 6,
    id: '120000040323',
    status: 'occupied',
    remainingSeconds: 2 * 3600 + 7 * 60 + 11,
    payload: payloadFor('120000040323'),
    payloadStatus: '已识别（增强图像复核）',
    photo: '图片 06',
    source: photoSource('Weixin Image_20260926220549_22_16.jpg'),
  },
  {
    order: 7,
    id: '120000040412',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000040412'),
    payloadStatus: '已识别',
    photo: '图片 07',
    source: photoSource('Weixin Image_20260926220551_24_16.jpg'),
  },
  {
    order: 8,
    id: '120000039638',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000039638'),
    payloadStatus: '已识别',
    photo: '图片 08',
    source: photoSource('Weixin Image_20260926220552_25_16.jpg'),
  },
  {
    order: 9,
    id: '120000039816',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000039816'),
    payloadStatus: '已识别',
    photo: '图片 09',
    source: photoSource('Weixin Image_20260926220552_26_16.jpg'),
  },
  {
    order: 10,
    id: '120000041570',
    status: 'available',
    remainingSeconds: 0,
    payload: payloadFor('120000041570'),
    payloadStatus: '已识别',
    photo: '图片 10',
    source: photoSource('Weixin Image_20260926220553_27_16.jpg'),
  },
] as const;

/** Backwards-friendly alias for consumers that call the collection `PORTS`. */
export const PARKING_PORT_DATA = PARKING_PORTS;

export const formatParkingDuration = (totalSeconds: number): string => {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export const statusLabel = (status: ParkingPortStatus): string =>
  status === 'occupied' ? '占用中' : '未占用';
