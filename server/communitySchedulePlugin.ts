import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type StoredCourse = {
  id: string;
  name: string;
  teacher: string;
  weekday: number;
  startPeriod: number;
  endPeriod: number;
  weeks: number[];
  weekParity: 'all' | 'odd' | 'even' | 'custom';
  location: string;
  buildingId: string | null;
  buildingName: string;
  tags: string[];
};

type CommunityStore = {
  schemaVersion: 1;
  updatedAt: string;
  users: Record<string, { updatedAt: string; termId: string; courses: StoredCourse[] }>;
};

const DATA_FILE = resolve(process.env.CSU_COMMUNITY_SCHEDULE_FILE ?? resolve(process.cwd(), 'data/community-schedules.json'));
const MAX_BODY_BYTES = 2 * 1024 * 1024;
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

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseCourse(value: unknown): StoredCourse | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = cleanText(raw.name, 80);
  const teacher = cleanText(raw.teacher, 40);
  const weekday = Number(raw.weekday);
  const startPeriod = Number(raw.startPeriod);
  const endPeriod = Number(raw.endPeriod);
  const parity = raw.weekParity;
  const weeks = Array.isArray(raw.weeks)
    ? [...new Set(raw.weeks.map(Number).filter((week) => Number.isInteger(week) && week >= 1 && week <= 30))].sort((a, b) => a - b)
    : [];

  if (
    !name
    || !Number.isInteger(weekday) || weekday < 1 || weekday > 7
    || !Number.isInteger(startPeriod) || startPeriod < 1 || startPeriod > 20
    || !Number.isInteger(endPeriod) || endPeriod < startPeriod || endPeriod > 20
    || weeks.length === 0
    || !['all', 'odd', 'even', 'custom'].includes(String(parity))
  ) return null;

  return {
    id: cleanText(raw.id, 100) || randomUUID(),
    name,
    teacher,
    weekday,
    startPeriod,
    endPeriod,
    weeks,
    weekParity: parity as StoredCourse['weekParity'],
    location: cleanText(raw.location, 100),
    buildingId: typeof raw.buildingId === 'string' && raw.buildingId.trim()
      ? raw.buildingId.trim().slice(0, 80)
      : null,
    buildingName: cleanText(raw.buildingName, 80),
    tags: Array.isArray(raw.tags)
      ? [...new Set(raw.tags.map((tag) => cleanText(tag, 24)).filter(Boolean))].slice(0, 8)
      : [],
  };
}

async function readStore(): Promise<CommunityStore> {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8')) as CommunityStore;
    if (raw.schemaVersion !== 1 || !raw.users || typeof raw.users !== 'object') {
      throw new Error('invalid schema');
    }
    return raw;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), users: {} };
    }
    throw error;
  }
}

async function commitStore(store: CommunityStore) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const temporary = `${DATA_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(temporary, DATA_FILE);
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function signature(course: StoredCourse) {
  return JSON.stringify([
    course.name.toLocaleLowerCase('zh-CN'),
    course.teacher.toLocaleLowerCase('zh-CN'),
    course.weekday,
    course.startPeriod,
    course.endPeriod,
    course.weeks,
    course.weekParity,
    course.location.toLocaleLowerCase('zh-CN'),
    course.buildingName.toLocaleLowerCase('zh-CN'),
  ]);
}

function cleanTermId(value: unknown) {
  const termId = cleanText(value, 60);
  return /^[\p{L}\p{N}_.\-\s]+$/u.test(termId) ? termId : 'current-term';
}

function aggregate(store: CommunityStore, termId: string) {
  const groups = new Map<string, { course: StoredCourse; users: Set<string>; tags: Set<string> }>();
  for (const [userId, contribution] of Object.entries(store.users)) {
    if ((contribution.termId || 'current-term') !== termId) continue;
    const seen = new Set<string>();
    for (const course of contribution.courses) {
      const key = signature(course);
      if (seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { course, users: new Set<string>(), tags: new Set<string>() };
      group.users.add(userId);
      course.tags.forEach((tag) => group.tags.add(tag));
      groups.set(key, group);
    }
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      ...group.course,
      id: `shared-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`,
      tags: [...group.tags].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      contributorCount: group.users.size,
    }))
    .sort((a, b) => a.weekday - b.weekday || a.startPeriod - b.startPeriod || a.name.localeCompare(b.name, 'zh-CN'));
}

async function handleApi(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/api/community-courses') {
    try {
      const store = await readStore();
      const termId = cleanTermId(url.searchParams.get('termId'));
      json(response, 200, {
        updatedAt: store.updatedAt,
        termId,
        contributorCount: Object.values(store.users).filter(
          (contribution) => (contribution.termId || 'current-term') === termId && contribution.courses.length > 0,
        ).length,
        courses: aggregate(store, termId),
      });
    } catch {
      fail(response, 503, 'COMMUNITY_DATA_UNAVAILABLE', '共享课池暂时无法读取，个人课表未受影响。');
    }
    return;
  }

  const match = ['PUT', 'DELETE'].includes(request.method ?? '')
    ? url.pathname.match(/^\/api\/community-schedules\/([a-zA-Z0-9-]{8,80})$/)
    : null;
  if (!match) {
    fail(response, 404, 'NOT_FOUND', '未找到该数据接口。');
    return;
  }

  try {
    if (request.method === 'DELETE') {
      const result = await new Promise<CommunityStore>((resolveWrite, rejectWrite) => {
        writeQueue = writeQueue.then(async () => {
          const store = await readStore();
          delete store.users[match[1]];
          store.updatedAt = new Date().toISOString();
          await commitStore(store);
          resolveWrite(store);
        }).catch(rejectWrite);
      });
      json(response, 200, { updatedAt: result.updatedAt, removed: true });
      return;
    }

    const payload = await readBody(request) as { courses?: unknown[]; termId?: unknown };
    if (!payload || !Array.isArray(payload.courses) || payload.courses.length > 200) {
      fail(response, 400, 'INVALID_SCHEDULE', '课表格式不正确或课程数超过 200 条。');
      return;
    }
    const courses = payload.courses.map(parseCourse);
    const termId = cleanTermId(payload.termId);
    if (courses.some((course) => !course)) {
      fail(response, 422, 'INVALID_COURSE', '存在无法汇总的课程字段，请检查周次和节次。');
      return;
    }

    const result = await new Promise<CommunityStore>((resolveWrite, rejectWrite) => {
      writeQueue = writeQueue.then(async () => {
        const store = await readStore();
        const updatedAt = new Date().toISOString();
        store.users[match[1]] = { updatedAt, termId, courses: courses as StoredCourse[] };
        store.updatedAt = updatedAt;
        await commitStore(store);
        resolveWrite(store);
      }).catch(rejectWrite);
    });
    json(response, 200, {
      updatedAt: result.updatedAt,
      termId,
      contributorCount: Object.values(result.users).filter(
        (contribution) => (contribution.termId || 'current-term') === termId && contribution.courses.length > 0,
      ).length,
      courses: aggregate(result, termId),
    });
  } catch (error) {
    if ((error as Error).message === 'BODY_TOO_LARGE') {
      fail(response, 413, 'SCHEDULE_TOO_LARGE', '课表数据超过可接收大小。');
      return;
    }
    fail(response, 500, 'COMMUNITY_SAVE_FAILED', '个人课表已保留在浏览器，但本次共享课池同步未完成。');
  }
}

export function communitySchedulePlugin(): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (!request.url?.startsWith('/api/community-')) {
      next();
      return;
    }
    void handleApi(request, response);
  };

  return {
    name: 'csu-community-schedules',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
