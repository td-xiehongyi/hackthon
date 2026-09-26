import { EMPTY_TIMETABLE, type TimetableSnapshot } from './types';
import { normalizeSnapshot } from './domain';

const DB_NAME = 'csu-pixel-campus-personal';
const DB_VERSION = 1;
const STORE_NAME = 'timetable';
const RECORD_KEY = 'current';
const FALLBACK_KEY = 'csu-campus-timetable-v1';

function fallbackRead(): TimetableSnapshot {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_TIMETABLE;
    const raw = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? 'null');
    // 兼容早期手工预览版保存的课程数组，避免升级后静默丢失。
    return normalizeSnapshot(Array.isArray(raw) ? { courses: raw } : raw);
  } catch { return EMPTY_TIMETABLE; }
}

function fallbackWrite(snapshot: TimetableSnapshot): void {
  if (typeof localStorage === 'undefined') throw new Error('localStorage unavailable');
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

export async function loadTimetable(): Promise<TimetableSnapshot> {
  try {
    const db = await openDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return normalizeSnapshot(value ?? fallbackRead());
  } catch {
    return fallbackRead();
  }
}

export async function saveTimetable(snapshot: TimetableSnapshot): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(snapshot, RECORD_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch (error) {
    try { fallbackWrite(snapshot); } catch { throw error; }
  }
}
