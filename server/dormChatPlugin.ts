import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * 本机升华公寓群聊接口。
 *
 * 这是一个小而明确的本机数据接口：不接账号、不把内容发往云端，
 * 用固定楼栋白名单把每条消息放进对应房间。后续接 WebSocket 时，
 * 前端的 room id 和消息形状可以原样保留。
 */
export const SHENGHUA_BUILDING_IDS = [
  'shenghua-1', 'shenghua-2', 'shenghua-3', 'shenghua-4',
  'shenghua-5', 'shenghua-6', 'shenghua-7', 'shenghua-8',
] as const;

const DATA_FILE = resolve(
  process.env.CSU_DORM_CHAT_FILE ?? resolve(import.meta.dirname, '..', 'data/dorm-chat.json'),
);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 240;
const MAX_NICKNAME_LENGTH = 16;
const MAX_MESSAGES_PER_ROOM = 200;
const MESSAGE_ID_RE = /^[a-zA-Z0-9_-]{8,100}$/;

export type DormChatMessage = {
  id: string;
  nickname: string;
  text: string;
  createdAt: string;
};

type DormChatStore = {
  schemaVersion: 1;
  updatedAt: string;
  rooms: Record<string, DormChatMessage[]>;
};

let writeQueue = Promise.resolve();

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function fail(response: ServerResponse, status: number, code: string, message: string) {
  json(response, status, { error: { code, message } });
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function containsControlCharacter(value: string): boolean {
  // 保留换行和制表符，禁止不可见控制字符，避免日志/终端注入。
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return (code >= 0 && code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f;
  });
}

function emptyStore(): DormChatStore {
  return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), rooms: {} };
}

function normalizeStore(value: unknown): DormChatStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid store');
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !raw.rooms || typeof raw.rooms !== 'object' || Array.isArray(raw.rooms)) {
    throw new Error('invalid store');
  }
  const rooms: Record<string, DormChatMessage[]> = {};
  for (const buildingId of SHENGHUA_BUILDING_IDS) {
    const rawMessages = (raw.rooms as Record<string, unknown>)[buildingId];
    if (rawMessages === undefined) continue;
    if (!Array.isArray(rawMessages)) throw new Error('invalid room');
    rooms[buildingId] = rawMessages.filter((message): message is DormChatMessage => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
      const item = message as Record<string, unknown>;
      return typeof item.id === 'string'
        && typeof item.nickname === 'string'
        && typeof item.text === 'string'
        && typeof item.createdAt === 'string'
        && MESSAGE_ID_RE.test(item.id)
        && item.nickname.length <= MAX_NICKNAME_LENGTH
        && item.text.length <= MAX_TEXT_LENGTH
        && !containsControlCharacter(item.nickname)
        && !containsControlCharacter(item.text)
        && !Number.isNaN(Date.parse(item.createdAt));
    }).slice(-MAX_MESSAGES_PER_ROOM);
  }
  return {
    schemaVersion: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    rooms,
  };
}

async function readStore(): Promise<DormChatStore> {
  try {
    return normalizeStore(JSON.parse(await readFile(DATA_FILE, 'utf8')) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function commitStore(store: DormChatStore): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const temporary = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(temporary, DATA_FILE);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function isLocalHost(host: string): boolean {
  const name = host.includes(':') ? host.slice(0, host.lastIndexOf(':')) : host;
  return name === '127.0.0.1' || name === 'localhost' || name === '::1' || name === '[::1]';
}

function canWrite(request: IncomingMessage): boolean {
  const host = request.headers.host ?? '';
  if (!isLocalHost(host)) return false;
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return true;
  const origin = request.headers.origin;
  if (!origin) return true; // 本机脚本/测试请求没有 Origin，也仍受 Host 限制。
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

function isBuildingId(value: string): value is (typeof SHENGHUA_BUILDING_IDS)[number] {
  return (SHENGHUA_BUILDING_IDS as readonly string[]).includes(value);
}

async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!canWrite(request)) {
    fail(response, 403, 'REQUEST_ORIGIN_REJECTED', '仅允许本机入口访问群聊。');
    return;
  }
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const match = url.pathname.match(/^\/api\/dorm-chat\/([^/]+)\/messages$/);
  if (!match || !isBuildingId(match[1])) {
    fail(response, 404, 'DORM_ROOM_NOT_FOUND', '未找到该宿舍楼群聊。');
    return;
  }
  const buildingId = match[1];

  if (request.method === 'GET') {
    try {
      const store = await readStore();
      const after = url.searchParams.get('after');
      const all = store.rooms[buildingId] ?? [];
      const start = after ? Math.max(0, all.findIndex((message) => message.id === after) + 1) : 0;
      json(response, 200, { buildingId, messages: all.slice(start).slice(-50), updatedAt: store.updatedAt });
    } catch {
      fail(response, 503, 'DORM_CHAT_UNAVAILABLE', '群聊数据暂时无法读取，本机聊天仍可继续。');
    }
    return;
  }

  if (request.method !== 'POST') {
    fail(response, 405, 'METHOD_NOT_ALLOWED', '群聊接口不支持该请求方法。');
    return;
  }

  try {
    const payload = await readBody(request) as { nickname?: unknown; text?: unknown; id?: unknown };
    const rawNickname = typeof payload?.nickname === 'string' ? payload.nickname.trim() : '';
    const rawText = typeof payload?.text === 'string' ? payload.text.trim() : '';
    const nickname = rawNickname.slice(0, MAX_NICKNAME_LENGTH);
    const text = rawText.slice(0, MAX_TEXT_LENGTH);
    const id = cleanText(payload?.id, 100) || randomUUID();
    if (!nickname || !text || rawNickname.length > MAX_NICKNAME_LENGTH || rawText.length > MAX_TEXT_LENGTH || !MESSAGE_ID_RE.test(id)) {
      fail(response, 422, 'INVALID_DORM_MESSAGE', '昵称和消息不能为空，且消息不超过 240 字。');
      return;
    }
    if (containsControlCharacter(nickname) || containsControlCharacter(text)) {
      fail(response, 422, 'INVALID_DORM_MESSAGE', '消息包含不可用的控制字符。');
      return;
    }

    const result = await new Promise<{ store: DormChatStore; message: DormChatMessage }>((resolveWrite, rejectWrite) => {
      const operation = writeQueue.then(async () => {
        const store = await readStore();
        const room = store.rooms[buildingId] ?? [];
        const existing = room.find((message) => message.id === id);
        if (existing) {
          resolveWrite({ store, message: existing });
          return;
        }
        const message: DormChatMessage = { id, nickname, text, createdAt: new Date().toISOString() };
        store.rooms[buildingId] = [...room, message].slice(-MAX_MESSAGES_PER_ROOM);
        store.updatedAt = message.createdAt;
        await commitStore(store);
        resolveWrite({ store, message });
      });
      // 单次写入失败不能让队列永久进入 rejected 状态；下一条消息仍应可重试。
      writeQueue = operation.then(() => undefined, () => undefined);
      operation.catch(rejectWrite);
    });
    json(response, 201, { buildingId, message: result.message, updatedAt: result.store.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'BODY_TOO_LARGE') {
      fail(response, 413, 'DORM_MESSAGE_TOO_LARGE', '消息请求超过大小限制。');
      return;
    }
    if (message === 'INVALID_JSON') {
      fail(response, 400, 'INVALID_REQUEST', '请求体不是合法 JSON。');
      return;
    }
    fail(response, 503, 'DORM_CHAT_SAVE_FAILED', '消息未能保存，请稍后重试。');
  }
}

export function dormChatPlugin(): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith('/api/dorm-chat/')) {
      next();
      return;
    }
    void handleApi(request, response);
  };

  return {
    name: 'csu-dorm-chat',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
