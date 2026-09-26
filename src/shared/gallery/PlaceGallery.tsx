import { useCallback, useEffect, useRef, useState } from 'react';
import type { Capabilities, PhotoMeta, PlaceId } from '../contracts';
import { ApiClientError, NetworkError, campusApi, newUploadRequestId } from '../api/client';
import './PlaceGallery.css';

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'success' }
  | { kind: 'failed'; message: string }
  | { kind: 'unconfirmed'; message: string };

export interface PlaceGalleryProps {
  placeId: PlaceId;
  /** 上传进行中时通知宿主，用于注册关闭守卫。 */
  onActivityChange?: (busy: boolean) => void;
}

export default function PlaceGallery({ placeId, onActivityChange }: PlaceGalleryProps) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  const [viewing, setViewing] = useState<PhotoMeta | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [caps, list] = await Promise.all([campusApi.getCapabilities(), campusApi.list(placeId)]);
      if (!mountedRef.current) return;
      setCapabilities(caps);
      setPhotos(list.photos);
    } catch (err) {
      if (!mountedRef.current) return;
      setLoadError(err instanceof Error ? err.message : '读取失败');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const busy = upload.kind === 'uploading';
  useEffect(() => {
    onActivityChange?.(busy);
  }, [busy, onActivityChange]);

  const policyPending = capabilities?.imagePolicy.status === 'pending';
  const accepted =
    capabilities?.imagePolicy.status === 'configured'
      ? capabilities.imagePolicy.acceptedMimeTypes.join(',')
      : 'image/*';

  async function handleFile(file: File) {
    const requestId = newUploadRequestId();
    setUpload({ kind: 'uploading' });
    try {
      await campusApi.upload(placeId, file, requestId);
      if (!mountedRef.current) return;
      setUpload({ kind: 'success' });
      await load();
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof NetworkError) {
        // 写请求断线：不轻易断言成功或失败，按 uploadRequestId 重新查询核对。
        setUpload({ kind: 'unconfirmed', message: '保存结果未确认，正在核对…' });
        try {
          const list = await campusApi.list(placeId);
          const found = list.photos.find((p) => p.uploadRequestId === requestId);
          if (!mountedRef.current) return;
          if (found) {
            setPhotos(list.photos);
            setUpload({ kind: 'success' });
          } else {
            setUpload({ kind: 'unconfirmed', message: '保存结果未确认，请重新选择图片重试' });
          }
        } catch {
          if (mountedRef.current) setUpload({ kind: 'unconfirmed', message: '保存结果未确认，请稍后刷新相册核对' });
        }
      } else if (err instanceof ApiClientError) {
        setUpload({ kind: 'failed', message: err.message });
      } else {
        setUpload({ kind: 'failed', message: '上传失败' });
      }
    }
  }

  function onPick() {
    const input = fileInputRef.current;
    if (!input || busy || policyPending) return;
    input.value = '';
    input.click();
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function uploadLabel(): string {
    switch (upload.kind) {
      case 'uploading': return '上传中…';
      case 'success': return '上传成功';
      case 'idle': return '上传图片';
      default: return '上传图片';
    }
  }

  return (
    <section className="place-gallery" aria-label="地点相册">
      <div className="gallery-head">
        <h2>地点相册</h2>
        <span className="gallery-count" role="status">{photos.length} 张图片</span>
      </div>

      {policyPending && (
        <p className="gallery-note" role="status">图片政策尚未配置，暂不可上传。</p>
      )}

      <div className="gallery-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept={accepted}
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onPick}
          disabled={busy || policyPending}
        >
          {uploadLabel()}
        </button>
        {upload.kind === 'failed' && <span className="gallery-msg error" role="alert">{upload.message}</span>}
        {upload.kind === 'unconfirmed' && <span className="gallery-msg warn" role="status">{upload.message}</span>}
      </div>

      {loading && <p className="gallery-status">正在加载相册…</p>}
      {!loading && loadError && (
        <p className="gallery-status error" role="alert">读取失败：{loadError}</p>
      )}
      {!loading && !loadError && photos.length === 0 && (
        <div className="gallery-empty">
          <p>还没有图片，上传第一张吧。</p>
        </div>
      )}
      {!loading && !loadError && photos.length > 0 && (
        <ul className="gallery-grid">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button type="button" className="gallery-thumb" onClick={() => setViewing(photo)}>
                <img src={campusApi.photoFileUrl(photo.id)} alt={`相册图片 ${photo.id}`} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <div className="gallery-lightbox" role="dialog" aria-label="图片大图预览" onClick={() => setViewing(null)}>
          <button type="button" className="gallery-lightbox-close" aria-label="关闭大图" onClick={() => setViewing(null)}>×</button>
          <img src={campusApi.photoFileUrl(viewing.id)} alt="相册图片大图" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}
