/**
 * 统一 API 客户端（docs/03）。所有模块经此访问本机服务，一律同源相对路径 /api/v1/...，
 * 不硬编码端口。
 *
 * 结果区分三类：
 * - ok：服务端已确认；
 * - rejected：服务端明确拒绝（带 ApiError）；
 * - unconfirmed：网络不可达、超时或响应丢失——写请求的结果**未确认**，不能断言成功或失败。
 */

import type {
  ApiError,
  Capabilities,
  PhotoList,
  PhotoMeta,
  PlaceId,
  PublicContentSnapshot,
  SavePublicContentRequest,
} from '@/shared/contracts';

export type ApiResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'rejected'; status: number; error: ApiError['error'] }
  | { kind: 'unconfirmed'; message: string };

const BASE = '/api/v1';
const TIMEOUT_MS = 30_000;

function isApiError(value: unknown): value is ApiError {
  const error = (value as ApiError | null)?.error;
  return typeof error?.code === 'string' && typeof error?.message === 'string';
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal, cache: 'no-store' });
  } catch {
    return { kind: 'unconfirmed', message: '无法连接本机数据服务，或请求超时。' };
  } finally {
    clearTimeout(timer);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // 代理在服务未启动时会返回非 JSON 的 5xx。
    return response.ok
      ? { kind: 'unconfirmed', message: '服务响应无法解析。' }
      : { kind: 'unconfirmed', message: '本机数据服务未启动或暂时不可用。' };
  }
  if (response.ok) return { kind: 'ok', value: body as T };
  if (isApiError(body)) return { kind: 'rejected', status: response.status, error: body.error };
  return { kind: 'unconfirmed', message: '本机数据服务未启动或暂时不可用。' };
}

export const api = {
  capabilities: () => request<Capabilities>('/capabilities'),
  listPhotos: (placeId: PlaceId) => request<PhotoList>(`/places/${encodeURIComponent(placeId)}/photos`),
  /** uploadRequestId 由调用方为每次新上传生成，重试时必须复用。 */
  uploadPhoto: (placeId: PlaceId, file: File, uploadRequestId: string) => {
    const form = new FormData();
    form.append('file', file);
    return request<PhotoMeta>(
      `/places/${encodeURIComponent(placeId)}/photos`,
      { method: 'POST', body: form, headers: { 'Idempotency-Key': uploadRequestId } },
      120_000,
    );
  },
  readPublicContent: () => request<PublicContentSnapshot>('/public-content'),
  savePublicContent: (body: SavePublicContentRequest) =>
    request<PublicContentSnapshot>('/public-content', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
};

export function newUploadRequestId(): string {
  return crypto.randomUUID();
}
