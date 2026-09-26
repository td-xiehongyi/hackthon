/**
 * 共用地点相册（docs/01 第 4.3 节）。公共参数只有 placeId。
 *
 * 状态严格区分：加载中 / 空相册 / 读取失败 / 政策待配置 / 上传中 / 保存成功 / 上传失败 / 结果未确认。
 * - 空相册不填充示例照片。
 * - 只有收到已提交结果，或重新查询确认相同 uploadRequestId 已存在，才显示“保存成功”。
 * - 结果未确认时保留原文件和同一个 uploadRequestId，允许用同一编号重试，不生成新编号盲目重复上传。
 *
 * 不提供删除、说明文字、排序或批量选择（均为待确认功能）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryProps, ImagePolicy, PhotoMeta } from '@/shared/contracts';
import { api, newUploadRequestId, type ApiResult } from '@/shared/api/client';

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; photos: PhotoMeta[] }
  | { kind: 'error'; message: string };

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'success'; fileName: string }
  | { kind: 'failed'; fileName: string; message: string }
  | { kind: 'unconfirmed'; fileName: string; message: string };

interface PendingUpload {
  file: File;
  requestId: string;
}

function describe(result: Exclude<ApiResult<unknown>, { kind: 'ok' }>) {
  return result.kind === 'rejected' ? result.error.message : result.message;
}

export default function PlaceGallery({ placeId }: GalleryProps) {
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [policy, setPolicy] = useState<ImagePolicy | null>(null);
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  const [viewing, setViewing] = useState<PhotoMeta | null>(null);
  const pending = useRef<PendingUpload | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const result = await api.listPhotos(placeId);
    if (!mounted.current) return null;
    if (result.kind === 'ok') {
      setList({ kind: 'ready', photos: result.value.photos });
      return result.value.photos;
    }
    setList({ kind: 'error', message: describe(result) });
    return null;
  }, [placeId]);

  useEffect(() => {
    setList({ kind: 'loading' });
    void refresh();
    void api.capabilities().then((result) => {
      if (mounted.current) setPolicy(result.kind === 'ok' ? result.value.imagePolicy : null);
    });
  }, [refresh]);

  const send = useCallback(
    async (job: PendingUpload) => {
      setUpload({ kind: 'uploading', fileName: job.file.name });
      const result = await api.uploadPhoto(placeId, job.file, job.requestId);
      if (!mounted.current) return;
      if (result.kind === 'ok') {
        pending.current = null;
        setUpload({ kind: 'success', fileName: job.file.name });
        await refresh();
        return;
      }
      if (result.kind === 'rejected') {
        pending.current = null;
        setUpload({ kind: 'failed', fileName: job.file.name, message: result.error.message });
        return;
      }
      // 结果未确认：重新读取相册，查找同一 uploadRequestId。
      const photos = await refresh();
      if (!mounted.current) return;
      if (photos?.some((p) => p.uploadRequestId === job.requestId)) {
        pending.current = null;
        setUpload({ kind: 'success', fileName: job.file.name });
      } else {
        setUpload({ kind: 'unconfirmed', fileName: job.file.name, message: result.message });
      }
    },
    [placeId, refresh],
  );

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const job = { file, requestId: newUploadRequestId() };
    pending.current = job;
    void send(job);
  }

  const policyReady = policy?.status === 'configured';
  const busy = upload.kind === 'uploading';

  return (
    <section className="gallery" aria-label="地点相册">
      <header className="gallery-header">
        <h3>地点相册</h3>
        <div className="gallery-actions">
          <input
            ref={input}
            type="file"
            hidden
            accept={policy?.status === 'configured' ? policy.acceptedMimeTypes.join(',') : undefined}
            onChange={onPick}
            aria-label="选择要上传的图片"
          />
          <button onClick={() => input.current?.click()} disabled={!policyReady || busy || list.kind !== 'ready'}>
            {busy ? '上传中…' : '上传图片'}
          </button>
        </div>
      </header>

      {policy?.status === 'pending' && (
        <p className="gallery-note" role="note">图片格式与大小限制尚未确认，暂不能上传；已有图片仍可查看。</p>
      )}
      {policy?.status === 'configured' && (
        <p className="gallery-note gallery-policy">
          支持 {policy.acceptedMimeTypes.map((t) => t.replace('image/', '').toUpperCase()).join('、')}，单张不超过{' '}
          {Math.round(policy.maxFileBytes / 1024 / 1024)} MB。
        </p>
      )}

      {upload.kind === 'uploading' && <p className="gallery-status" role="status">正在上传 {upload.fileName}…</p>}
      {upload.kind === 'success' && <p className="gallery-status gallery-ok" role="status">{upload.fileName} 已保存到本地点相册。</p>}
      {upload.kind === 'failed' && (
        <p className="place-error" role="alert">上传失败：{upload.message}（相册保持原样）</p>
      )}
      {upload.kind === 'unconfirmed' && (
        <div className="place-error" role="alert">
          <p>保存结果未确认：{upload.message}</p>
          <button onClick={() => pending.current && void send(pending.current)} disabled={!pending.current}>
            用同一请求重试
          </button>
        </div>
      )}

      {list.kind === 'loading' && <p className="gallery-status" role="status">正在读取相册…</p>}
      {list.kind === 'error' && (
        <div className="place-error" role="alert">
          <p>相册读取失败：{list.message}</p>
          <button onClick={() => void refresh()}>重试</button>
        </div>
      )}
      {list.kind === 'ready' && list.photos.length === 0 && (
        <p className="gallery-empty">这里还没有图片。{policyReady ? '点“上传图片”添加第一张。' : ''}</p>
      )}
      {list.kind === 'ready' && list.photos.length > 0 && (
        <ul className="gallery-grid" aria-label="图片列表">
          {list.photos.map((photo, index) => (
            <li key={photo.id}>
              <button className="gallery-thumb" onClick={() => setViewing(photo)} aria-label={`查看第 ${index + 1} 张图片`}>
                <img src={photo.fileUrl} alt={`地点图片 ${index + 1}`} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div className="gallery-viewer" role="dialog" aria-modal="true" aria-label="查看大图">
          <img src={viewing.fileUrl} alt="放大查看的地点图片" />
          <p>上传于 {new Date(viewing.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
          <button onClick={() => setViewing(null)} autoFocus>返回相册</button>
        </div>
      )}
    </section>
  );
}
