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

const DEFAULT_ALLOWED_ORIGINS = ['http://127.0.0.1:5173', 'http://127.0.0.1:8787'];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const host = env.CAMPUS_HOST ?? '127.0.0.1';
  const port = Number(env.CAMPUS_PORT ?? 8787);
  const dataRoot = path.resolve(env.CAMPUS_DATA_ROOT ?? 'data');

  // 图片政策：格式/大小/容量未由用户确认，正式保持 pending；
  // 仅当显式设置 CAMPUS_IMAGE_POLICY=dev 时才作为“开发测试配置”启用。
  const imagePolicy: ImagePolicyStatus = env.CAMPUS_IMAGE_POLICY === 'dev' ? 'configured' : 'pending';

  const acceptedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const maxFileBytes = Number(env.CAMPUS_MAX_FILE_BYTES ?? 10 * 1024 * 1024);
  const maxAlbumBytes = env.CAMPUS_MAX_ALBUM_BYTES ? Number(env.CAMPUS_MAX_ALBUM_BYTES) : null;
  const maxAlbumCount = env.CAMPUS_MAX_ALBUM_COUNT ? Number(env.CAMPUS_MAX_ALBUM_COUNT) : null;

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
