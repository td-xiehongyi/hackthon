import type { SavedScene } from './package';

const DB_NAME = 'csu-imported-scenes-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('scenes', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地场景存储。'));
    request.onblocked = () => reject(new Error('本地存储正被另一个页面占用，请关闭旧页面后重试。'));
  });
}
export async function loadScenes(): Promise<SavedScene[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scenes', 'readonly');
    const request = tx.objectStore('scenes').getAll();
    tx.oncomplete = () => { db.close(); resolve((request.result as SavedScene[]).sort((a, b) => b.importedAt - a.importedAt)); };
    tx.onabort = () => { db.close(); reject(new Error('读取本地场景失败。')); };
  });
}
export async function saveScene(scene: SavedScene): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scenes', 'readwrite');
    let conflict = false;
    const store = tx.objectStore('scenes');
    const request = store.get(scene.id);
    request.onsuccess = () => {
      const previous = request.result as SavedScene | undefined;
      if (previous ? (previous.revision ?? 0) + 1 !== scene.revision : scene.revision !== 0) {
        conflict = true; tx.abort(); return;
      }
      store.put(scene);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error(conflict ? '另一个页面已更新此场景，请刷新页面后再保存。' : '保存失败，浏览器存储可能已满。请导出 ZIP 备份后清理空间。')); };
  });
}
