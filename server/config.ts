import path from 'node:path';

export type ImagePolicyStatus = 'pending' | 'configured';

export interface ServerConfig {
  /** 仅监听本机回环地址，不得为 0.0.0.0 或局域网地址。 */
  host: string;
  port: number;
  /** 运行数据根目录（相对于项目数据根定位，避免多工作目录产生多套数据）。 */
  dataRoot: string;
  /** 允许发起写请求的本机来源（Origin）。 */
  allowedOrigins: string[];
  imagePolicy: ImagePolicyStatus;
  acceptedMimeTypes: string[];
  maxFileBytes: number;
  maxAlbumBytes: number | null;
  maxAlbumCount: number | null;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
  'http://localhost:5173',
  'http://localhost:8787',
];

/** 项目根目录（server/ 的上一级），数据目录默认固定在此，不随启动时的工作目录变化。 */
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

function parsePositiveInt(name: string, raw: string | undefined, fallback: number): number;
function parsePositiveInt(name: string, raw: string | undefined, fallback: null): number | null;
function parsePositiveInt(name: string, raw: string | undefined, fallback: number | null): number | null {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`环境变量 ${name} 须为正整数，当前值：${raw}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.CAMPUS_HOST ?? '127.0.0.1';
  const port = parsePositiveInt('CAMPUS_PORT', env.CAMPUS_PORT, 8787);
  const dataRoot = env.CAMPUS_DATA_ROOT
    ? path.resolve(PROJECT_ROOT, env.CAMPUS_DATA_ROOT)
    : path.join(PROJECT_ROOT, 'data');

  // 本机地点相册默认可用；保留 pending 作为显式停用开关，兼容旧 dev 配置。
  const imagePolicy: ImagePolicyStatus = env.CAMPUS_IMAGE_POLICY === 'pending' ? 'pending' : 'configured';

  const acceptedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const maxFileBytes = parsePositiveInt('CAMPUS_MAX_FILE_BYTES', env.CAMPUS_MAX_FILE_BYTES, 10 * 1024 * 1024);
  const maxAlbumBytes = parsePositiveInt('CAMPUS_MAX_ALBUM_BYTES', env.CAMPUS_MAX_ALBUM_BYTES, null);
  const maxAlbumCount = parsePositiveInt('CAMPUS_MAX_ALBUM_COUNT', env.CAMPUS_MAX_ALBUM_COUNT, null);

  const allowedOrigins = env.CAMPUS_ALLOWED_ORIGINS
    ? env.CAMPUS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;

  return {
    host,
    port,
    dataRoot,
    allowedOrigins,
    imagePolicy,
    acceptedMimeTypes,
    maxFileBytes,
    maxAlbumBytes,
    maxAlbumCount,
  };
}
