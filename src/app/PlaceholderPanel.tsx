/**
 * 阶段 1 占位地点页。
 *
 * 用途：在尚无图书馆/教学楼群/体育场正式功能页时，验证宿主协议本身——
 * sessionId 传递、onRequestClose 关闭流程、registerCloseGuard 未保存修改拦截、
 * onLocate 三类定位结果、buildings 空目录的未关联状态。
 *
 * 这不是任何一个地点的成品页面，不提供业务功能；正式页面接入后本组件应删除。
 */

import { useEffect, useState } from 'react';
import type { LocateResult, NavigationTarget, PlacePanelProps } from '../shared/contracts';
import PlaceGallery from '../shared/gallery/PlaceGallery';

const PLACEHOLDER_NOTICE = '占位页面：仅用于验证宿主协议，不是正式地点功能页。';

export default function PlaceholderPanel({
  place,
  sessionId,
  buildings,
  onRequestClose,
  onLocate,
  registerCloseGuard,
}: PlacePanelProps) {
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  useEffect(() => uploading ? registerCloseGuard(() => false) : undefined, [uploading, registerCloseGuard]);
  const [locateResult, setLocateResult] = useState<LocateResult | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const dirty = draft.trim().length > 0;

  // 有未保存修改时注册关闭检查；无修改时注销，避免残留回调。
  useEffect(() => {
    if (!dirty) return;
    return registerCloseGuard(() => {
      const confirmed = window.confirm('此处有未保存的输入，确定返回校园吗？');
      return confirmed;
    });
  }, [dirty, registerCloseGuard]);

  async function handleLocate(target: NavigationTarget) {
    setLocateResult(await onLocate(target));
  }

  return (
    <section className="place-panel" aria-label={`${place.name}功能页面`}>
      <header className="place-header">
        <div>
          <p className="eyebrow">PLACE · {place.featureKey.toUpperCase()}</p>
          <h2>{place.name}</h2>
          <p className="place-meta">
            校区：{place.campusId} · 地点 ID：{place.placeId}
          </p>
        </div>
        <button className="place-return" onClick={onRequestClose}>返回校园</button>
      </header>

      <p className="place-notice" role="note">{PLACEHOLDER_NOTICE}</p>

      <dl className="place-facts">
        <div><dt>本次会话</dt><dd>{sessionId}</dd></div>
        <div><dt>已登记楼座</dt><dd>{buildings.length === 0 ? '暂无已核验楼座' : `${buildings.length} 座`}</dd></div>
      </dl>

      <div className="place-body">
        <label className="place-field">
          <span>未保存修改检查（输入任意文字后尝试返回）</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="在此输入内容，E 键不触发地图互动"
          />
        </label>
        {dirty && <p className="place-hint">已输入内容，返回时会先请求确认。</p>}

        <div className="place-actions">
          <button onClick={() => handleLocate({ kind: 'place', placeId: place.placeId })}>定位本地点</button>
          <button onClick={() => handleLocate({ kind: 'building', buildingId: 'unverified-building' })}>定位未登记楼座</button>
          <button
            onClick={() => handleLocate({ kind: 'landmark', landmarkId: 'unknown-landmark' })}
            onDoubleClick={() => setCloseError('占位：此处演示关闭异常提示')}
          >
            定位未知地标
          </button>
        </div>

        {locateResult && (
          <p className="place-hint" role="status">
            定位结果：{locateResult.status}
            {'message' in locateResult ? ` — ${locateResult.message}` : ''}
          </p>
        )}
        {closeError && <p className="place-error" role="alert">{closeError}</p>}
      </div>
      <PlaceGallery placeId={place.placeId} onActivityChange={setUploading} />
    </section>
  );
}
