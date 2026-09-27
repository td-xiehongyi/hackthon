import { strFromU8, zipSync, strToU8 } from 'fflate';
import { extractEntry, inspectZip } from './zip-safety';

export type Position = { x: number; y: number };
export type ScenePoint = {
  id: string; name: string; position: Position; radius: number;
  feature: 'photos' | 'clubs' | 'reviews' | 'timetable';
  photos: { path: string; caption: string }[];
  clubs: { name: string; description: string }[];
  reviews: { author: string; rating: number; text: string }[];
  courses: { name: string; time: string; teacher: string }[];
};
export type Scene = {
  schemaVersion: 1; name: string; map: string; style: 'original' | 'pixel-art';
  collision: 'boundary'; spawn: Position; points: ScenePoint[];
};
export type ScenePackage = { scene: Scene; assets: Record<string, Blob> };
export type SavedScene = ScenePackage & { id: string; importedAt: number; revision: number };
export const MAX_ZIP_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const imagePath = /\.(png|jpe?g|webp)$/i;
const fail = (message: string): never => { throw new Error(message); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('场景信息必须是有效对象。');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, optional = false): string {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail('场景文字为空、过长或格式不正确。');
  return value as string;
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('场景坐标、范围或评分不正确。');
  return value as number;
}
function position(value: unknown): Position {
  const p = object(value);
  return { x: number(p.x, 0, 1), y: number(p.y, 0, 1) };
}
function list<T>(value: unknown, convert: (item: Record<string, unknown>) => T, max = 500): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) fail('场景列表格式错误或条目过多。');
  return (value as unknown[]).map(item => convert(object(item)));
}
function safePath(path: string): string {
  if (!path || path.includes('\\') || path.includes(':') || /[\x00-\x1f]/.test(path) || path.startsWith('/') || path.split('/').some(p => p === '..' || p === '.' || !p)) fail('ZIP 中包含不安全的文件路径。');
  return path;
}

export function imageBlob(bytes: Uint8Array, path: string): Blob {
  if (bytes.length > MAX_IMAGE_BYTES) fail('单张图片不能超过 16 MB。');
  let mime = '';
  if (bytes.length >= 24 && bytes[0] === 137 && strFromU8(bytes.subarray(1, 4)) === 'PNG' && strFromU8(bytes.subarray(12, 16)) === 'IHDR') mime = 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  if (bytes.length >= 16 && strFromU8(bytes.subarray(0, 4)) === 'RIFF' && strFromU8(bytes.subarray(8, 12)) === 'WEBP') mime = 'image/webp';
  const extension = path.toLowerCase().split('.').pop();
  if (!mime || (mime === 'image/png' ? extension !== 'png' : mime === 'image/webp' ? extension !== 'webp' : !['jpg', 'jpeg'].includes(extension ?? ''))) fail('图片内容无效，仅支持 PNG、JPEG、WebP。');
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

export function parseSceneZip(bytes: Uint8Array): ScenePackage {
  if (bytes.length > MAX_ZIP_BYTES) fail('ZIP 不能超过 64 MB。');
  let total = 0;
  const names = new Set<string>();
  // Inspect every entry before allocating decompressed images. Never use archive code.
  const inspect = (file: { name: string; originalSize: number; compression: number }) => {
    safePath(file.name.endsWith('/') ? file.name.slice(0, -1) : file.name);
    if (names.has(file.name)) fail('ZIP 中包含重复文件名。');
    names.add(file.name);
    total += file.originalSize;
    if (names.size > 512 || total > MAX_ZIP_BYTES) fail('ZIP 文件数或解压后体积超出限制。');
    const limit = file.name.endsWith('scene.json') ? 2 * 1024 * 1024 : MAX_IMAGE_BYTES;
    if (file.originalSize > limit) fail('ZIP 中的单个文件过大。');
    if (![0, 8].includes(file.compression)) fail('请使用普通 ZIP 压缩格式。');
    return false;
  };
  let entries: ReturnType<typeof inspectZip>;
  try { entries = inspectZip(bytes); entries.forEach(inspect); }
  catch (error) { if (error instanceof Error && /ZIP|场景|请/.test(error.message)) throw error; return fail('无法读取 ZIP，请确认文件完整。'); }
  const files: Record<string, Uint8Array> = Object.create(null);
  try { for (const entry of entries) if (entry.name.endsWith('scene.json') || imagePath.test(entry.name)) files[entry.name] = extractEntry(bytes, entry); }
  catch { return fail('ZIP 解压失败，请重新导出。'); }
  for (const entry of entries) if (files[entry.name] && files[entry.name].length !== entry.originalSize) fail('ZIP 解压后的文件大小不一致。');
  const manifests = Object.keys(files).filter(path => path === 'scene.json' || /^[^/]+\/scene\.json$/.test(path));
  let root = '';
  let raw: Record<string, unknown>;
  if (manifests.length === 1) {
    const path = manifests[0];
    root = path.slice(0, -'scene.json'.length);
    try { raw = object(JSON.parse(strFromU8(files[path]))); } catch { return fail('scene.json 不是有效的场景描述。'); }
  } else if (!manifests.length && !Object.keys(files).some(path => path.endsWith('scene.json'))) {
    const images = Object.keys(files).filter(path => imagePath.test(path));
    if (images.length !== 1) fail('ZIP 需要 scene.json；只有一张图片的 ZIP 也可以导入。');
    raw = { schemaVersion: 1, name: '导入的场景', map: images[0] };
  } else { return fail('ZIP 必须只有一个 scene.json，放在根目录或一层文件夹内。'); }
  if (raw.schemaVersion !== 1) fail('不支持此场景版本，需要 schemaVersion: 1。');
  if (raw.collision !== undefined && raw.collision !== 'boundary') fail('目前只支持地图边界碰撞。');
  if (raw.style !== undefined && !['original', 'pixel-art'].includes(String(raw.style))) fail('场景风格字段不正确。');
  const assets: Record<string, Blob> = Object.create(null);
  const asset = (value: unknown): string => {
    const path = safePath(text(value, 240));
    const bytes = files[root + path];
    if (!imagePath.test(path) || !bytes) fail(`缺少图片：${path}`);
    assets[path] ??= imageBlob(bytes, path);
    return path;
  };
  const ids = new Set<string>();
  const points = list(raw.points, p => {
    const id = text(p.id, 64);
    if (!/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) fail('交互点 ID 格式错误或重复。');
    ids.add(id);
    if (!['photos', 'clubs', 'reviews', 'timetable'].includes(String(p.feature))) fail('不支持此交互类型。');
    return {
      id, name: text(p.name, 80), position: position(p.position), radius: number(p.radius ?? .045, .005, .3), feature: p.feature as ScenePoint['feature'],
      photos: list(p.photos, i => ({ path: asset(i.path), caption: text(i.caption, 200, true) })),
      clubs: list(p.clubs, i => ({ name: text(i.name, 80), description: text(i.description, 2000, true) })),
      reviews: list(p.reviews, i => {
        const rating = number(i.rating, 1, 5);
        if (!Number.isInteger(rating)) fail('点评分数必须是 1–5 的整数。');
        return { author: text(i.author, 50), rating, text: text(i.text, 2000) };
      }),
      courses: list(p.courses, i => ({ name: text(i.name, 100), time: text(i.time, 100), teacher: text(i.teacher, 100, true) })),
    };
  }, 200);
  return { scene: { schemaVersion: 1, name: text(raw.name, 80), map: asset(raw.map), style: (raw.style ?? 'original') as Scene['style'], collision: 'boundary', spawn: raw.spawn === undefined ? { x: .5, y: .5 } : position(raw.spawn), points }, assets };
}

export async function validateImages(assets: Record<string, Blob>): Promise<void> {
  // Browser decode catches truncated/corrupt files that merely have valid headers.
  for (const blob of Object.values(assets)) {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob); } catch { return fail('包内有无法显示的图片，请检查后重新导入。'); }
    const tooLarge = bitmap.width > 16384 || bitmap.height > 16384 || bitmap.width * bitmap.height > 40_000_000;
    bitmap.close();
    if (tooLarge) fail('图片分辨率过大，最长边需不超过 16384，且总像素不超过 4000 万。');
  }
}

export async function exportSceneZip(value: ScenePackage): Promise<Blob> {
  assertPackageBudget(value);
  const files: Record<string, Uint8Array> = { 'scene.json': strToU8(JSON.stringify(value.scene)) };
  for (const [path, blob] of Object.entries(value.assets)) files[path] = new Uint8Array(await blob.arrayBuffer());
  const bytes = new Uint8Array(zipSync(files, { level: 0 }));
  if (bytes.length > MAX_ZIP_BYTES) fail('导出 ZIP 超过 64 MB，请减少照片或内容。');
  return new Blob([bytes], { type: 'application/zip' });
}

export function assertPackageBudget(value: ScenePackage): void {
  const manifestSize = strToU8(JSON.stringify(value.scene)).length;
  const paths = ['scene.json', ...Object.keys(value.assets)];
  const total = Object.values(value.assets).reduce((sum, blob) => sum + blob.size, manifestSize);
  // Stored ZIP overhead, including the optional Unicode path fields emitted by fflate.
  const overhead = 22 + paths.reduce((sum, path) => sum + 94 + 4 * strToU8(path).length, 0);
  if (manifestSize > 2 * 1024 * 1024 || total + overhead > MAX_ZIP_BYTES || paths.length > 512) fail('场景已达到包容量限制，请减少照片或内容。');
}
