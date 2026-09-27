import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { PhotoMeta, PlaceId, PublicContentSnapshot } from '../src/shared/contracts.ts';
import { ApiError } from './errors.ts';

/**
 * 数据目录布局（data 不进入 Git、不进入 dist）：
 *   data/
 *     public-content.json
 *     photos/
 *       index.json
 *       files/
 */

export interface PhotoUploadRecord {
  placeId: PlaceId;
  /** 服务端计算的文件内容摘要（十六进制），用于幂等比较。 */
  digest: string;
  photoId: string;
}

export interface PhotoIndex {
  schemaVersion: 1;
  photos: PhotoMeta[];
  uploads: Record<string, PhotoUploadRecord>;
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function emptySnapshot(): PublicContentSnapshot {
  return { schemaVersion: 1, revision: 0, clubs: [], activities: [] };
}

export function emptyPhotoIndex(): PhotoIndex {
  return { schemaVersion: 1, photos: [], uploads: {} };
}

export function readJson<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new ApiError(503, 'STORAGE_DATA_INVALID', '数据文件缺失：' + path.basename(filePath));
  }
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    throw new ApiError(503, 'STORAGE_DATA_INVALID', '数据文件不可读取：' + path.basename(filePath));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(503, 'STORAGE_DATA_INVALID', '数据文件损坏：' + path.basename(filePath));
  }
}

/** 写入同一目录的临时文件并 fsync 后原子替换，避免 GET 读到半成品。 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${randomUUID()}.json`);
  const json = JSON.stringify(value, null, 2);
  const fd = openSync(tmp, 'w');
  try {
    writeFileSync(fd, json, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, filePath);
}

export class DataStore {
  readonly dataRoot: string;
  private readonly snapshotPath: string;
  private readonly indexPath: string;
  private readonly filesDir: string;

  constructor(dataRoot: string) {
    this.dataRoot = dataRoot;
    this.snapshotPath = path.join(dataRoot, 'public-content.json');
    this.indexPath = path.join(dataRoot, 'photos', 'index.json');
    this.filesDir = path.join(dataRoot, 'photos', 'files');
  }

  /**
   * 首次初始化与“读取已有数据失败”严格区分（按数据文件是否存在判断，
   * 而非目录：data/ 因 .gitkeep 在仓库中始终存在）：
   * - 两个数据文件都不存在 → 创建合法的空快照与空相册索引；
   * - 任一文件已存在但缺失/损坏 → 抛错，绝不重置为空。
   */
  initialize(): { initialized: boolean } {
    const hasSnapshot = existsSync(this.snapshotPath);
    const hasIndex = existsSync(this.indexPath);
    if (hasSnapshot || hasIndex) {
      if (!hasSnapshot) {
        throw new ApiError(503, 'STORAGE_DATA_INVALID', '数据文件缺失：public-content.json');
      }
      if (!hasIndex) {
        throw new ApiError(503, 'STORAGE_DATA_INVALID', '数据文件缺失：photos/index.json');
      }
      this.readSnapshot();
      this.readIndex();
      return { initialized: false };
    }
    mkdirSync(this.filesDir, { recursive: true });
    writeJsonAtomic(this.snapshotPath, emptySnapshot());
    writeJsonAtomic(this.indexPath, emptyPhotoIndex());
    return { initialized: true };
  }

  readSnapshot(): PublicContentSnapshot {
    return readJson<PublicContentSnapshot>(this.snapshotPath);
  }

  readIndex(): PhotoIndex {
    return readJson<PhotoIndex>(this.indexPath);
  }

  commitSnapshot(snapshot: PublicContentSnapshot): void {
    writeJsonAtomic(this.snapshotPath, snapshot);
  }

  commitIndex(index: PhotoIndex): void {
    writeJsonAtomic(this.indexPath, index);
  }

  savePhotoFile(photoId: string, buffer: Buffer): void {
    mkdirSync(this.filesDir, { recursive: true });
    writeFileSync(path.join(this.filesDir, photoId), buffer);
  }

  readPhotoFile(photoId: string): Buffer {
    const filePath = path.join(this.filesDir, photoId);
    if (!existsSync(filePath)) {
      throw new ApiError(503, 'STORAGE_DATA_INVALID', '图片文件缺失：' + photoId);
    }
    return readFileSync(filePath);
  }
}
