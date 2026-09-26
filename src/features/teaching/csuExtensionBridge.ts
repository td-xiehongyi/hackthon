/**
 * Boundary for the optional CSU browser extension.
 *
 * The extension never calls the teaching system from this app. It sends a
 * small, user-triggered JSON payload through window.postMessage after the
 * student clicks its button on the already logged-in CSU page. Keeping the
 * validation here makes the React page safe to embed on another origin and
 * keeps arbitrary messages out of the schedule parser.
 */

export const CSU_EXTENSION_SOURCE = 'csu-browser-extension';
export const CSU_EXTENSION_MESSAGE = 'CSU_SCHEDULE_CAPTURE';
export const CSU_EXTENSION_MAX_BYTES = 2 * 1024 * 1024;
export const CSU_EXTENSION_MAX_COURSES = 500;

export interface CsuExtensionPayload {
  source: typeof CSU_EXTENSION_SOURCE;
  capturedAt?: string;
  pageUrl?: string;
  pageTitle?: string;
  courses: Array<Record<string, unknown>>;
}
export interface CsuExtensionMessage {
  source: typeof CSU_EXTENSION_SOURCE;
  type: typeof CSU_EXTENSION_MESSAGE;
  payload: CsuExtensionPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Keep only fields understood by caImport; never forward DOM/credential data. */
const sanitizeCourse = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const allowed = [
    'title', 'name', 'kcmc', 'teacher', 'weekday', 'xq', 'jc', 'periods',
    'weeks', 'weekParity', 'location', 'buildingName', 'room', 'jx0404id',
  ] as const;
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    const candidate = value[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') result[key] = candidate;
  }
  return Object.keys(result).length ? result : null;
};

/**
 * Validate and bound a message received from a content script.
 * `expectedOrigin` should normally be `window.location.origin`.
 */
export function readCsuExtensionMessage(
  event: MessageEvent<unknown>,
  expectedOrigin?: string,
  sourceWindow?: Window,
): CsuExtensionMessage | null {
  if (sourceWindow && event.source !== sourceWindow) return null;
  if (expectedOrigin && event.origin !== expectedOrigin) return null;
  if (!isRecord(event.data)) return null;
  if (event.data.source !== CSU_EXTENSION_SOURCE || event.data.type !== CSU_EXTENSION_MESSAGE) return null;

  const rawPayload = event.data.payload;
  if (!isRecord(rawPayload) || rawPayload.source !== CSU_EXTENSION_SOURCE || !Array.isArray(rawPayload.courses)) return null;
  if (rawPayload.courses.length === 0 || rawPayload.courses.length > CSU_EXTENSION_MAX_COURSES) return null;

  const courses = rawPayload.courses.map(sanitizeCourse).filter((course): course is Record<string, unknown> => Boolean(course));
  if (!courses.length) return null;

  const payload: CsuExtensionPayload = {
    source: CSU_EXTENSION_SOURCE,
    capturedAt: typeof rawPayload.capturedAt === 'string' ? rawPayload.capturedAt.slice(0, 80) : undefined,
    pageUrl: typeof rawPayload.pageUrl === 'string' ? rawPayload.pageUrl.slice(0, 500) : undefined,
    pageTitle: typeof rawPayload.pageTitle === 'string' ? rawPayload.pageTitle.slice(0, 200) : undefined,
    courses,
  };
  const message: CsuExtensionMessage = {
    source: CSU_EXTENSION_SOURCE,
    type: CSU_EXTENSION_MESSAGE,
    payload,
  };
  // Bound the serialised payload as a final guard against huge title fields.
  if (new TextEncoder().encode(JSON.stringify(message)).byteLength > CSU_EXTENSION_MAX_BYTES) return null;
  return message;
}
