import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import type {
  Capabilities,
  PhotoList,
  PhotoMeta,
  PlaceId,
  PublicContentSnapshot,
  SavePublicContentRequest,
} from '../src/shared/contracts.ts';
import type { ServerConfig } from './config.ts';
import { ApiError } from './errors.ts';
import { DataStore, sha256Hex } from './storage.ts';
import { assertPlaceId, detectMediaType, extensionFor, validatePublicContent } from './validation.ts';
import { registerCanteenReviews } from './canteen-reviews.ts';

const PLACE_IDS: PlaceId[] = [
  'xiaoxiang_library',
  'xiaoxiang_teaching_group',
  'xiaoxiang_sports_ground',
  'lunan_canteen_2',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HARD_FILE_CAP = 64 * 1024 * 1024; // 内存保护上限，实际限制由图片政策决定

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isLocalHost(host: string): boolean {
  const name = host.includes(':') ? host.slice(0, host.lastIndexOf(':')) : host;
  return name === '127.0.0.1' || name === 'localhost' || name === '::1' || name === '[::1]';
}

function toImagePolicy(config: ServerConfig) {
  if (config.imagePolicy !== 'configured') {
    return { status: 'pending' as const };
  }
  return {
    status: 'configured' as const,
    acceptedMimeTypes: config.acceptedMimeTypes,
    maxFileBytes: config.maxFileBytes,
    maxAlbumBytes: config.maxAlbumBytes,
    maxAlbumCount: config.maxAlbumCount,
  };
}

type MultipartPart = {
  type: 'file' | 'field';
  fieldname: string;
  filename?: string;
  toBuffer: () => Promise<Buffer>;
};

async function readSingleFile(
  req: FastifyRequest,
): Promise<{ filename: string; buffer: Buffer }> {
  if (!req.isMultipart()) {
    throw new ApiError(400, 'INVALID_REQUEST', '请求须为 multipart/form-data');
  }
  let buffer: Buffer | null = null;
  let filename = '';
  let fileCount = 0;
  try {
    for await (const part of req.parts() as AsyncIterable<MultipartPart>) {
      if (part.type === 'file') {
        fileCount += 1;
        if (fileCount > 1) throw new ApiError(400, 'INVALID_REQUEST', '一次只允许上传一个文件');
        if (part.fieldname !== 'file') throw new ApiError(400, 'INVALID_REQUEST', '意外文件字段');
        if (!part.filename) throw new ApiError(400, 'INVALID_REQUEST', '缺少文件名');
        filename = part.filename;
        buffer = await part.toBuffer();
      } else {
        throw new ApiError(400, 'INVALID_REQUEST', '意外字段');
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const code = (err as { code?: string }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      throw new ApiError(413, 'FILE_TOO_LARGE', '图片超过大小限制');
    }
    if (code === 'FST_PARTS_LIMIT' || code === 'FST_FILES_LIMIT' || code === 'FST_FIELDS_LIMIT') {
      throw new ApiError(400, 'INVALID_REQUEST', 'multipart 字段或文件数量超出限制');
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'multipart 请求解析失败或连接中断');
  }
  if (fileCount !== 1 || !buffer) {
    throw new ApiError(400, 'INVALID_REQUEST', '需要恰好一个名为 file 的图片文件');
  }
  return { filename, buffer };
}

export function buildApp(config: ServerConfig): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });
  const store = new DataStore(config.dataRoot);
  store.initialize();

  app.register(multipart, { limits: { fileSize: HARD_FILE_CAP } });

  app.addHook('onRequest', (req, _reply, done) => {
    const host = req.headers.host ?? '';
    if (!isLocalHost(host)) {
      done(new ApiError(403, 'REQUEST_ORIGIN_REJECTED', '仅允许本机入口访问'));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const origin = req.headers.origin;
      if (!origin || !config.allowedOrigins.includes(origin)) {
        done(new ApiError(403, 'REQUEST_ORIGIN_REJECTED', '请求来源不属于允许的本机入口'));
        return;
      }
    }
    done();
  });

  registerCanteenReviews(app, config.dataRoot);

  app.get('/api/v1/capabilities', async () => {
    const caps: Capabilities = {
      apiVersion: 'v1',
      contractVersion: '1.0.0',
      placeIds: PLACE_IDS,
      imagePolicy: toImagePolicy(config),
      features: {
        photoUpload: 'single',
        photoDelete: false,
        photoCaption: false,
        photoReorder: false,
      },
    };
    return caps;
  });

  app.get('/api/v1/public-content', async () => {
    return store.readSnapshot();
  });

  app.put('/api/v1/public-content', async (req) => {
    const body = req.body as Record<string, unknown>;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError(400, 'INVALID_REQUEST', '请求体须为 JSON 对象');
    }
    const topKeys = Object.keys(body);
    if (topKeys.some((k) => k !== 'expectedRevision' && k !== 'content')) {
      throw new ApiError(400, 'INVALID_REQUEST', '请求体含未知字段');
    }
    const expectedRevision = body.expectedRevision;
    if (
      typeof expectedRevision !== 'number' ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0
    ) {
      throw new ApiError(400, 'INVALID_REQUEST', 'expectedRevision 须为非负整数');
    }
    const content = body.content;
    if (content === null || typeof content !== 'object' || Array.isArray(content)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'content 须为对象');
    }
    const contentKeys = Object.keys(content as Record<string, unknown>);
    if (contentKeys.some((k) => k !== 'clubs' && k !== 'activities')) {
      throw new ApiError(400, 'INVALID_REQUEST', 'content 含未知字段');
    }
    const { clubs, activities } = content as { clubs: unknown; activities: unknown };
    if (!Array.isArray(clubs) || !Array.isArray(activities)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'clubs 与 activities 须为数组');
    }
    const candidate = { clubs, activities } as SavePublicContentRequest['content'];
    validatePublicContent(candidate);

    const current = store.readSnapshot();
    if (expectedRevision !== current.revision) {
      throw new ApiError(409, 'REVISION_CONFLICT', '公共内容已被其他修改更新');
    }
    const next: PublicContentSnapshot = {
      schemaVersion: 1,
      revision: current.revision + 1,
      clubs: candidate.clubs,
      activities: candidate.activities,
    };
    store.commitSnapshot(next);
    return next;
  });

  app.get('/api/v1/places/:placeId/photos', async (req) => {
    const { placeId } = req.params as { placeId: string };
    assertPlaceId(placeId);
    const index = store.readIndex();
    const result: PhotoList = {
      placeId,
      photos: index.photos.filter((p) => p.placeId === placeId),
    };
    return result;
  });

  app.post('/api/v1/places/:placeId/photos', async (req, reply) => {
    const { placeId } = req.params as { placeId: string };
    assertPlaceId(placeId);

    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !isUuid(key)) {
      throw new ApiError(400, 'INVALID_REQUEST', '需要合法的 Idempotency-Key 请求头');
    }

    const { buffer } = await readSingleFile(req);
    const digest = sha256Hex(buffer);

    const index = store.readIndex();
    const existing = index.uploads[key];
    if (existing) {
      if (existing.placeId === placeId && existing.digest === digest) {
        const meta = index.photos.find((p) => p.id === existing.photoId);
        if (!meta) {
          throw new ApiError(503, 'STORAGE_DATA_INVALID', '幂等记录引用的图片缺失');
        }
        return reply.code(201).send(meta);
      }
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '该上传键已用于不同地点或不同文件');
    }

    if (config.imagePolicy !== 'configured') {
      throw new ApiError(503, 'IMAGE_POLICY_PENDING', '图片政策尚未配置，暂不可上传');
    }
    const mediaType = detectMediaType(buffer);
    if (!mediaType) {
      throw new ApiError(422, 'INVALID_IMAGE', '图片无法解码或类型未知');
    }
    if (!config.acceptedMimeTypes.includes(mediaType)) {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '图片类型不支持');
    }
    if (buffer.length > config.maxFileBytes) {
      throw new ApiError(413, 'FILE_TOO_LARGE', '图片超过单张大小限制');
    }

    const album = index.photos.filter((p) => p.placeId === placeId);
    if (config.maxAlbumCount != null && album.length >= config.maxAlbumCount) {
      throw new ApiError(409, 'ALBUM_LIMIT_REACHED', '相册图片数量已达上限');
    }
    if (config.maxAlbumBytes != null) {
      const used = album.reduce((sum, p) => sum + p.byteSize, 0);
      if (used + buffer.length > config.maxAlbumBytes) {
        throw new ApiError(409, 'ALBUM_LIMIT_REACHED', '相册容量已达上限');
      }
    }

    const photoId = `${randomUUID()}${extensionFor(mediaType)}`;
    store.savePhotoFile(photoId, buffer);
    const meta: PhotoMeta = {
      id: photoId,
      placeId,
      mediaType,
      byteSize: buffer.length,
      createdAt: new Date().toISOString(),
      fileUrl: `/api/v1/photos/${photoId}/file`,
      uploadRequestId: key,
    };
    index.photos.push(meta);
    index.uploads[key] = { placeId, digest, photoId };
    store.commitIndex(index);
    return reply.code(201).send(meta);
  });

  app.get('/api/v1/photos/:photoId/file', async (req, reply) => {
    const { photoId } = req.params as { photoId: string };
    const index = store.readIndex();
    const meta = index.photos.find((p) => p.id === photoId);
    if (!meta) {
      throw new ApiError(404, 'PHOTO_NOT_FOUND', '图片不存在');
    }
    let buffer: Buffer;
    try {
      buffer = store.readPhotoFile(photoId);
    } catch {
      throw new ApiError(503, 'STORAGE_DATA_INVALID', '图片文件缺失或不可读取');
    }
    return reply.type(meta.mediaType).header('X-Content-Type-Options', 'nosniff').send(buffer);
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      const body: { error: { code: string; message: string; fields?: { path: string; message: string }[] } } = {
        error: { code: err.code, message: err.message },
      };
      if (err.fields && err.fields.length > 0) body.error.fields = err.fields;
      return reply.status(err.status).send(body);
    }
    const anyErr = err as { statusCode?: number; code?: string };
    if (anyErr.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.status(413).send({ error: { code: 'INVALID_REQUEST', message: '请求体超过大小限制' } });
    }
    if (anyErr.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || anyErr.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      return reply.status(400).send({ error: { code: 'INVALID_REQUEST', message: '请求体不是合法 JSON' } });
    }
    if (anyErr.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.status(415).send({ error: { code: 'INVALID_REQUEST', message: '不支持的请求内容类型' } });
    }
    if (typeof anyErr.statusCode === 'number' && anyErr.statusCode >= 400 && anyErr.statusCode < 500) {
      return reply.status(anyErr.statusCode).send({ error: { code: 'INVALID_REQUEST', message: '请求不合法' } });
    }
    // logger 关闭时 req.log 不输出，这里直接写 stderr，保证 500 可排查。
    console.error(`[campus-server] ${req.method} ${req.url} 未处理异常：`, err);
    return reply.status(500).send({ error: { code: 'STORAGE_WRITE_FAILED', message: '服务内部错误' } });
  });

  return app;
}
