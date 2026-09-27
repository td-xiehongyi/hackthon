import type { PublishedCanteenReview, SubmitCanteenReview } from './data';

async function request<T>(method: 'GET' | 'POST', body?: SubmitCanteenReview): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/v1/canteen/reviews', {
      method, cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(method === 'GET' ? '暂时无法读取评价，请检查数据服务后重试。' : '未收到保存确认，请重试；重复提交不会重复保存。');
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error?.message ?? '评价服务暂不可用，请确认数据服务已更新并重启后重试。');
  }
  return response.json();
}

export const loadReviews = () => request<{ reviews: PublishedCanteenReview[] }>('GET');
export const publishReview = (review: SubmitCanteenReview) => request<PublishedCanteenReview>('POST', review);
