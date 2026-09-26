/**
 * 开发 / 测试替身：内存版 PublicContentApi。
 *
 * 用途：在 D 交付真实本机服务与 API 客户端之前，让 C 的查询页与编辑器能独立开发、联调。
 * 模拟真实服务的 revision 冲突与内容校验，但不落盘、不是真实服务。
 * 接入真实客户端后整体替换本文件，调用方代码不变。
 */
import type {
  ApiError,
  PublicContentApi,
  PublicContentSnapshot,
  SavePublicContentRequest,
} from '../stadium/types';
import { validateContent } from '../stadium/domain';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

function apiError(code: string, message: string, fields?: ApiError['error']['fields']): ApiError {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

export interface MockApiOptions {
  latencyMs?: number;
  initial?: PublicContentSnapshot;
}

export function createMockPublicContentApi(options: MockApiOptions = {}): PublicContentApi {
  const latencyMs = options.latencyMs ?? 0;
  let snapshot: PublicContentSnapshot = clone(
    options.initial ?? { schemaVersion: 1, revision: 0, clubs: [], activities: [] },
  );

  return {
    async read() {
      await delay(latencyMs);
      return clone(snapshot);
    },

    async save(request: SavePublicContentRequest) {
      await delay(latencyMs);
      if (request.expectedRevision !== snapshot.revision) {
        throw apiError('REVISION_CONFLICT', '内容已被其他会话更新，请重新加载最新内容后核对');
      }
      const errors = validateContent(request.content);
      if (errors.length > 0) {
        throw apiError('INVALID_CONTENT', '内容校验未通过', errors);
      }
      snapshot = {
        schemaVersion: 1,
        revision: snapshot.revision + 1,
        clubs: clone(request.content.clubs),
        activities: clone(request.content.activities),
      };
      return clone(snapshot);
    },
  };
}
