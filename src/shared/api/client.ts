import type {
  Capabilities,
  GalleryApi,
  PhotoList,
  PhotoMeta,
  PlaceId,
  PublicContentApi,
  PublicContentSnapshot,
  SavePublicContentRequest,
} from '../contracts';

const API_BASE = '/api/v1';

/** 服务返回的 ApiError（可显示给用户）。 */
export class ApiClientError extends Error {
  status: number | null;
  code: string;
  fields?: { path: string; message: string }[];

  constructor(
    status: number | null,
    code: string,
    message: string,
    fields?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** 网络不可达 / 超时 / 响应丢失，与服务器明确拒绝区分。 */
export class NetworkError extends Error {
  constructor(message = '无法连接本机服务') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** 为每次新的图片上传生成一个 UUID；同一上传重试时复用原值。 */
export function newUploadRequestId(): string {
  return crypto.randomUUID();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new NetworkError();
  }
  if (res.ok) {
    return (await res.json()) as T;
  }
  let parsed: { error?: { code?: string; message?: string; fields?: { path: string; message: string }[] } } | null = null;
  try {
    parsed = await res.json();
  } catch {
    /* 非 JSON 响应体 */
  }
  const e = parsed?.error;
  throw new ApiClientError(
    res.status,
    e?.code ?? 'UNKNOWN_ERROR',
    e?.message ?? `请求失败（${res.status}）`,
    e?.fields,
  );
}

export class CampusApiClient implements GalleryApi, PublicContentApi {
  getCapabilities(): Promise<Capabilities> {
    return request('/capabilities');
  }

  list(placeId: PlaceId): Promise<PhotoList> {
    return request(`/places/${placeId}/photos`);
  }

  upload(placeId: PlaceId, file: File, uploadRequestId: string): Promise<PhotoMeta> {
    const form = new FormData();
    form.append('file', file);
    return request(`/places/${placeId}/photos`, {
      method: 'POST',
      headers: { 'Idempotency-Key': uploadRequestId },
      body: form,
    });
  }

  read(): Promise<PublicContentSnapshot> {
    return request('/public-content');
  }

  save(payload: SavePublicContentRequest): Promise<PublicContentSnapshot> {
    return request('/public-content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  photoFileUrl(photoId: string): string {
    return `${API_BASE}/photos/${photoId}/file`;
  }
}

export const campusApi = new CampusApiClient();
