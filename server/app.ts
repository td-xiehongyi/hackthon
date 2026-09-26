/**
 * 本机 HTTP 服务（docs/03）。只挂载 6 条约定路由，不新增其他相册或课表接口。
 *
 * - 只接受配置中的本机入口作为 Host 与写请求 Origin；不设置跨域放行。
 * - 成功响应直接返回约定对象；所有错误使用统一 ApiError 结构，不泄露路径与堆栈。
 * - 图片政策为 pending 时，新上传返回 503 IMAGE_POLICY_PENDING；读取不受影响。
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { createReadStream } from 'node:fs';
import type { Capabilities, ImagePolicy, PlaceId, SavePublicContentRequest } from '../src/shared/contracts.ts';
import { ApiFailure } from './errors.ts';
import { validatePublicContent } from './content.ts';
import { sniffImage } from './image-sniff.ts';
import type { Storage } from './storage.ts';

export const PLACE_IDS: readonly PlaceId[] = ['xiaoxiang_library', 'xiaoxiang_teaching_group', 'xiaoxiang_sports_ground'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
/** multipart 解析的硬上限：防止未配置政策时收下超大请求体。实际单张限制以政策为准。 */
const HARD_BODY_LIMIT = 50 * 1024 * 1024;

export interface ServerOptions {
  storage: Storage;
  imagePolicy: ImagePolicy;
  /** 允许的浏览器入口，如 http://127.0.0.1:5173。 */
  allowedOrigins: readonly string[];
  /** 允许的 Host 头（含端口）。 */
  allowedHosts: readonly string[];
  logger?: boolean;
}

function isPlaceId(value: string): value is PlaceId {
  return (PLACE_IDS as readonly string[]).includes(value);
}

export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  const { storage, imagePolicy } = options;
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  await app.register(multipart, { limits: { files: 1, fields: 0, fileSize: HARD_BODY_LIMIT, parts: 2 } });

  // 统一错误出口。
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiFailure) return reply.code(error.status).send(error.toBody());
    const code = (error as { code?: string }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send(new ApiFailure(413, 'FILE_TOO_LARGE', '图片超过允许的大小。').toBody());
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(400).send(new ApiFailure(400, 'INVALID_REQUEST', '请求格式不正确。').toBody());
    }
    app.log.error(error);
    return reply.code(500).send(new ApiFailure(500, 'STORAGE_WRITE_FAILED', '服务内部错误，原有数据保持不变。').toBody());
  });
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(new ApiFailure(404, 'INVALID_REQUEST', '不存在的接口。').toBody());
  });

  // Host / Origin 校验；GET 响应禁止缓存，避免读到陈旧数据。
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const host = request.headers.host ?? '';
    if (!options.allowedHosts.includes(host)) {
      throw new ApiFailure(403, 'REQUEST_ORIGIN_REJECTED', '请通过配置的本机地址访问。');
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.origin;
      if (!origin || !options.allowedOrigins.includes(origin)) {
        throw new ApiFailure(403, 'REQUEST_ORIGIN_REJECTED', '写入请求必须来自配置的本机页面。');
      }
    }
    reply.header('Cache-Control', 'no-store');
  });

  app.get('/api/v1/capabilities', async (): Promise<Capabilities> => ({
    apiVersion: 'v1',
    contractVersion: '1.0.0',
    placeIds: [...PLACE_IDS],
    imagePolicy,
    features: { photoUpload: 'single', photoDelete: false, photoCaption: false, photoReorder: false },
  }));

  app.get('/api/v1/public-content', async () => storage.getSnapshot());

  app.put('/api/v1/public-content', async (request) => {
    const body = request.body as Partial<SavePublicContentRequest> | undefined;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiFailure(400, 'INVALID_REQUEST', '请求体必须是 JSON 对象。');
    }
    const unknown = Object.keys(body).filter((k) => k !== 'expectedRevision' && k !== 'content');
    if (unknown.length) {
      throw new ApiFailure(400, 'INVALID_REQUEST', '请求包含不支持的字段。', unknown.map((path) => ({ path, message: '不支持的字段' })));
    }
    if (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 0) {
      throw new ApiFailure(400, 'INVALID_REQUEST', 'expectedRevision 必须是非负整数。', [{ path: 'expectedRevision', message: '必须是非负整数' }]);
    }
    return storage.saveContent(body.expectedRevision as number, body.content as never, (c) => validatePublicContent(c));
  });

  app.get<{ Params: { placeId: string } }>('/api/v1/places/:placeId/photos', async (request) => {
    const { placeId } = request.params;
    if (!isPlaceId(placeId)) throw new ApiFailure(404, 'PLACE_NOT_FOUND', '不支持的地点。');
    return { placeId, photos: storage.listPhotos(placeId) };
  });

  app.post<{ Params: { placeId: string } }>('/api/v1/places/:placeId/photos', async (request, reply) => {
    const { placeId } = request.params;
    if (!isPlaceId(placeId)) throw new ApiFailure(404, 'PLACE_NOT_FOUND', '不支持的地点。');
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !UUID.test(key)) {
      throw new ApiFailure(400, 'INVALID_REQUEST', '缺少或无效的 Idempotency-Key（须为 UUID）。');
    }
    if (!request.isMultipart()) throw new ApiFailure(400, 'INVALID_REQUEST', '请使用 multipart/form-data 上传单张图片。');

    let bytes: Buffer | null = null;
    let count = 0;
    for await (const part of request.parts()) {
      count++;
      if (part.type !== 'file' || part.fieldname !== 'file' || count > 1) {
        throw new ApiFailure(400, 'INVALID_REQUEST', '只允许一个名为 file 的图片文件。');
      }
      bytes = await part.toBuffer();
    }
    if (!bytes || count !== 1) throw new ApiFailure(400, 'INVALID_REQUEST', '缺少图片文件。');

    const { photo } = await storage.addPhoto(placeId, key.toLowerCase(), bytes, (existing) => {
      if (imagePolicy.status !== 'configured') {
        throw new ApiFailure(503, 'IMAGE_POLICY_PENDING', '图片格式与大小限制尚未确认，暂不能上传；已有图片仍可查看。');
      }
      const info = sniffImage(bytes!);
      if (!info) throw new ApiFailure(422, 'INVALID_IMAGE', '无法识别为有效图片，文件可能已损坏。');
      if (!imagePolicy.acceptedMimeTypes.includes(info.mediaType)) {
        throw new ApiFailure(415, 'UNSUPPORTED_MEDIA_TYPE', `不支持该图片格式，允许：${imagePolicy.acceptedMimeTypes.join('、')}。`);
      }
      if (bytes!.length > imagePolicy.maxFileBytes) {
        throw new ApiFailure(413, 'FILE_TOO_LARGE', `图片超过单张 ${Math.round(imagePolicy.maxFileBytes / 1024 / 1024)} MB 限制。`);
      }
      if (imagePolicy.maxAlbumCount !== null && existing.length >= imagePolicy.maxAlbumCount) {
        throw new ApiFailure(409, 'ALBUM_LIMIT_REACHED', '该地点相册已达到数量上限。');
      }
      const used = existing.reduce((sum, p) => sum + p.byteSize, 0);
      if (imagePolicy.maxAlbumBytes !== null && used + bytes!.length > imagePolicy.maxAlbumBytes) {
        throw new ApiFailure(409, 'ALBUM_LIMIT_REACHED', '该地点相册已达到容量上限。');
      }
      return { mediaType: info.mediaType, extension: EXTENSIONS[info.mediaType]! };
    });
    return reply.code(201).send(photo);
  });

  app.get<{ Params: { photoId: string } }>('/api/v1/photos/:photoId/file', async (request, reply) => {
    const { photoId } = request.params;
    const photo = UUID.test(photoId) ? storage.findPhoto(photoId) : undefined;
    if (!photo) throw new ApiFailure(404, 'PHOTO_NOT_FOUND', '图片不存在。');
    const stream = createReadStream(storage.photoFilePath(photo));
    await new Promise<void>((resolve, reject) => {
      stream.once('open', () => resolve());
      stream.once('error', () => reject(new ApiFailure(503, 'STORAGE_DATA_INVALID', '图片记录存在但文件无法读取。')));
    });
    reply.header('Content-Type', photo.mediaType).header('X-Content-Type-Options', 'nosniff');
    return reply.send(stream);
  });

  return app;
}
