import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CANTEEN_FLOORS, type PublishedCanteenReview, type SubmitCanteenReview } from '../src/features/canteen/data.ts';
import { ApiError } from './errors.ts';
import { readJson, writeJsonAtomic } from './storage.ts';

const windowIds = new Set(CANTEEN_FLOORS.flatMap(floor => floor.windows.map(window => window.id)));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validReview(value: unknown): value is SubmitCanteenReview {
  if (!value || typeof value !== 'object') return false;
  const review = value as SubmitCanteenReview;
  return typeof review.id === 'string' && uuid.test(review.id) && typeof review.windowId === 'string' &&
    typeof review.author === 'string' && review.author.trim().length > 0 && review.author.length <= 30 &&
    typeof review.text === 'string' && review.text.trim().length > 0 && review.text.length <= 1000 &&
    Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5;
}

export function registerCanteenReviews(app: FastifyInstance, dataRoot: string): void {
  const file = join(dataRoot, 'canteen-reviews.json');
  function read(): PublishedCanteenReview[] {
    // 旧安装第一次使用此功能时尚无该文件。已有文件异常时保留原件并报错。
    if (!existsSync(file)) return [];
    const data = readJson<{ schemaVersion: number; reviews: PublishedCanteenReview[] }>(file);
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.reviews) ||
      !data.reviews.every(review => validReview(review) && typeof review.createdAt === 'string' && Number.isFinite(Date.parse(review.createdAt))) ||
      new Set(data.reviews.map(review => review.id)).size !== data.reviews.length) {
      throw new ApiError(503, 'STORAGE_DATA_INVALID', '评价文件格式异常，请保留数据文件并检查。');
    }
    return data.reviews;
  }

  app.get('/api/v1/canteen/reviews', async (_req, reply) => {
    return reply.header('Cache-Control', 'no-store').send({ reviews: read() });
  });
  app.post('/api/v1/canteen/reviews', { bodyLimit: 16 * 1024 }, async (req, reply) => {
    if (!validReview(req.body) || !windowIds.has(req.body.windowId)) {
      throw new ApiError(400, 'INVALID_REVIEW', '请填写有效窗口、1–5 分评分、昵称（最多 30 字）及评价（1–1000 字）。');
    }
    if (Object.keys(req.body).some(key => !['id', 'windowId', 'author', 'rating', 'text'].includes(key))) {
      throw new ApiError(400, 'INVALID_REVIEW', '评价含未知字段。');
    }
    const candidate = { ...req.body, id: req.body.id.toLowerCase(), author: req.body.author.trim(), text: req.body.text.trim() };
    // 读取、追加、落盘之间不让出事件循环，多个请求不会互相覆盖。
    const reviews = read();
    const existing = reviews.find(review => review.id === candidate.id);
    if (existing) {
      if (existing.windowId !== candidate.windowId || existing.author !== candidate.author || existing.rating !== candidate.rating || existing.text !== candidate.text) {
        throw new ApiError(409, 'REVIEW_CONFLICT', '该提交标识已用于另一条评价，请重新提交。');
      }
      return reply.code(201).send(existing);
    }
    const saved: PublishedCanteenReview = { ...candidate, createdAt: new Date().toISOString() };
    try { writeJsonAtomic(file, { schemaVersion: 1, reviews: [...reviews, saved] }); }
    catch { throw new ApiError(503, 'STORAGE_WRITE_FAILED', '评价保存失败，请稍后重试。'); }
    return reply.code(201).send(saved);
  });
}
