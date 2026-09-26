/**
 * 本机数据存储（docs/03 第 9 节）。
 *
 * data/
 *   public-content.json          公共社团与活动快照
 *   photos/index.json            相册索引（含幂等记录）
 *   photos/files/<photoId>.<ext> 图片文件
 *
 * 原则：
 * - 首次初始化只在数据目录**完全不存在**时由显式调用 init() 完成，并写入标记文件；
 *   已初始化后，任何读取失败都报 STORAGE_DATA_INVALID / STORAGE_UNAVAILABLE，绝不自动重置为空。
 * - 写入先写同目录临时文件、fsync、关闭，再 rename 原子替换；失败时旧文件保持有效。
 * - 公共内容与相册各有一条串行写入队列，版本检查 / 幂等检查 / 容量检查与提交在同一临界区。
 */

import { createHash, randomUUID } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { PhotoMeta, PlaceId, PublicContent, PublicContentSnapshot } from '../src/shared/contracts.ts';
import { ApiFailure } from './errors.ts';

const MARKER = '.csu-campus-data';

export interface StoredPhoto extends PhotoMeta {
  /** 服务端计算的内容摘要，仅用于幂等比对，不对外返回。 */
  sha256: string;
  /** 服务端生成的文件名，不对外返回。 */
  fileName: string;
}

interface PhotoIndex {
  schemaVersion: 1;
  photos: StoredPhoto[];
}

export class Serial {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

async function exists(path: string) {
  try {
    await fs.access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** 原子写入：临时文件 → fsync → close → rename。 */
export async function atomicWrite(path: string, data: string | Buffer) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  const handle = await fs.open(tmp, 'wx');
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, path);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

export class Storage {
  readonly contentPath: string;
  readonly indexPath: string;
  readonly filesDir: string;
  private readonly contentQueue = new Serial();
  private readonly photoQueue = new Serial();
  private snapshot: PublicContentSnapshot | null = null;
  private index: PhotoIndex | null = null;

  readonly root: string;

  constructor(root: string) {
    this.root = root;
    this.contentPath = join(root, 'public-content.json');
    this.indexPath = join(root, 'photos', 'index.json');
    this.filesDir = join(root, 'photos', 'files');
  }

  /**
   * 显式初始化：仅当数据目录不存在或为空（只有 .gitkeep）时建立空快照与空相册。
   * 目录中已有任何数据文件时拒绝，不覆盖。
   */
  async init(): Promise<'created' | 'already-initialized'> {
    if (await exists(join(this.root, MARKER))) return 'already-initialized';
    await fs.mkdir(this.root, { recursive: true });
    const entries = (await fs.readdir(this.root)).filter((name) => name !== '.gitkeep');
    if (entries.length > 0) {
      throw new Error(`数据目录 ${this.root} 已有文件（${entries.join(', ')}），但缺少初始化标记；为避免覆盖，已停止初始化。`);
    }
    await fs.mkdir(this.filesDir, { recursive: true });
    const empty: PublicContentSnapshot = { schemaVersion: 1, revision: 0, clubs: [], activities: [] };
    await atomicWrite(this.contentPath, `${JSON.stringify(empty, null, 2)}\n`);
    await atomicWrite(this.indexPath, `${JSON.stringify({ schemaVersion: 1, photos: [] }, null, 2)}\n`);
    await atomicWrite(join(this.root, MARKER), `initialized ${new Date().toISOString()}\n`);
    return 'created';
  }

  /** 启动时加载并检查已有数据；未初始化或损坏都报错，不自动修复。 */
  async open() {
    if (!(await exists(join(this.root, MARKER)))) {
      throw new ApiFailure(503, 'STORAGE_UNAVAILABLE', '本机数据目录尚未初始化，请先运行 npm run server:init。');
    }
    this.snapshot = await this.readContent();
    this.index = await this.readIndex();
    for (const photo of this.index.photos) {
      if (!(await exists(join(this.filesDir, photo.fileName)))) {
        throw new ApiFailure(503, 'STORAGE_DATA_INVALID', '相册索引引用的图片文件缺失，已保留原始数据，请检查数据目录。');
      }
    }
  }

  private async readJson(path: string): Promise<unknown> {
    let text: string;
    try {
      text = await fs.readFile(path, 'utf-8');
    } catch {
      throw new ApiFailure(503, 'STORAGE_UNAVAILABLE', '本机数据文件无法读取。');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiFailure(503, 'STORAGE_DATA_INVALID', '本机数据文件已损坏，已保留原文件，未自动重置。');
    }
  }

  private async readContent(): Promise<PublicContentSnapshot> {
    const value = (await this.readJson(this.contentPath)) as PublicContentSnapshot;
    if (
      value?.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.clubs) || !Array.isArray(value.activities)
    ) {
      throw new ApiFailure(503, 'STORAGE_DATA_INVALID', '公共内容文件结构不正确，已保留原文件。');
    }
    return value;
  }

  private async readIndex(): Promise<PhotoIndex> {
    const value = (await this.readJson(this.indexPath)) as PhotoIndex;
    if (value?.schemaVersion !== 1 || !Array.isArray(value.photos)) {
      throw new ApiFailure(503, 'STORAGE_DATA_INVALID', '相册索引结构不正确，已保留原文件。');
    }
    return value;
  }

  getSnapshot(): PublicContentSnapshot {
    if (!this.snapshot) throw new ApiFailure(503, 'STORAGE_UNAVAILABLE', '本机数据尚未加载。');
    return this.snapshot;
  }

  /** 版本检查、校验与原子替换处于同一串行流程；成功后才更新内存快照。 */
  saveContent(expectedRevision: number, content: PublicContent, validate: (c: PublicContent) => void) {
    return this.contentQueue.run(async () => {
      const current = this.getSnapshot();
      if (expectedRevision !== current.revision) {
        throw new ApiFailure(409, 'REVISION_CONFLICT', '公共内容已被更新，请重新读取最新版本后核对。');
      }
      validate(content);
      const next: PublicContentSnapshot = {
        schemaVersion: 1,
        revision: current.revision + 1,
        clubs: content.clubs,
        activities: content.activities,
      };
      try {
        await atomicWrite(this.contentPath, `${JSON.stringify(next, null, 2)}\n`);
      } catch {
        throw new ApiFailure(500, 'STORAGE_WRITE_FAILED', '公共内容保存失败，原有内容保持不变。');
      }
      this.snapshot = next;
      return next;
    });
  }

  private getIndex(): PhotoIndex {
    if (!this.index) throw new ApiFailure(503, 'STORAGE_UNAVAILABLE', '本机数据尚未加载。');
    return this.index;
  }

  listPhotos(placeId: PlaceId): PhotoMeta[] {
    return this.getIndex().photos.filter((p) => p.placeId === placeId).map(publicMeta);
  }

  findPhoto(photoId: string): StoredPhoto | undefined {
    return this.getIndex().photos.find((p) => p.id === photoId);
  }

  photoFilePath(photo: StoredPhoto) {
    return join(this.filesDir, photo.fileName);
  }

  /**
   * 上传提交（docs/03 第 9.3 节）。
   * checkNew 仅对新上传执行（政策、类型、大小、容量）；幂等重放直接返回已有结果。
   */
  addPhoto(
    placeId: PlaceId,
    uploadRequestId: string,
    bytes: Buffer,
    checkNew: (existing: readonly StoredPhoto[]) => { mediaType: string; extension: string },
  ): Promise<{ photo: PhotoMeta; replay: boolean }> {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return this.photoQueue.run(async () => {
      const index = this.getIndex();
      const prior = index.photos.find((p) => p.uploadRequestId === uploadRequestId);
      if (prior) {
        if (prior.placeId !== placeId || prior.sha256 !== sha256) {
          throw new ApiFailure(409, 'IDEMPOTENCY_CONFLICT', '该上传请求编号已用于其他地点或其他图片。');
        }
        return { photo: publicMeta(prior), replay: true };
      }
      const { mediaType, extension } = checkNew(index.photos.filter((p) => p.placeId === placeId));
      const id = randomUUID();
      const fileName = `${id}.${extension}`;
      const filePath = join(this.filesDir, fileName);
      try {
        await atomicWrite(filePath, bytes);
      } catch {
        throw new ApiFailure(500, 'STORAGE_WRITE_FAILED', '图片保存失败，相册保持原样。');
      }
      const photo: StoredPhoto = {
        id,
        placeId,
        mediaType,
        byteSize: bytes.length,
        createdAt: new Date().toISOString(),
        fileUrl: `/api/v1/photos/${id}/file`,
        uploadRequestId,
        sha256,
        fileName,
      };
      const next: PhotoIndex = { schemaVersion: 1, photos: [...index.photos, photo] };
      try {
        await atomicWrite(this.indexPath, `${JSON.stringify(next, null, 2)}\n`);
      } catch {
        // 索引未提交：只清理本次新写入、未关联的文件；已提交图片不受影响。
        await fs.rm(filePath, { force: true }).catch(() => undefined);
        throw new ApiFailure(500, 'STORAGE_WRITE_FAILED', '相册索引保存失败，相册保持原样。');
      }
      this.index = next;
      return { photo: publicMeta(photo), replay: false };
    });
  }
}

function publicMeta(photo: StoredPhoto): PhotoMeta {
  const { sha256: _sha, fileName: _file, ...meta } = photo;
  return meta;
}
