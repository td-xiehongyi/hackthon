import { describe, it, expect } from 'vitest';
import { createMockPublicContentApi } from '../../../src/features/content-editor/mockPublicContentApi';
import type { PublicContent, PublicContentSnapshot } from '../../../src/features/stadium/types';

function base(): PublicContentSnapshot {
  return {
    schemaVersion: 1,
    revision: 0,
    clubs: [{ id: 'c1', name: '足球协会', category: '体育竞技', summary: '', campusIds: [], links: [] }],
    activities: [],
  };
}

describe('mock PublicContentApi', () => {
  it('read 返回初始快照', async () => {
    const api = createMockPublicContentApi({ initial: base() });
    const s = await api.read();
    expect(s.revision).toBe(0);
    expect(s.clubs).toHaveLength(1);
  });

  it('正确版本号保存后 revision 递增', async () => {
    const api = createMockPublicContentApi({ initial: base() });
    const content: PublicContent = { clubs: [], activities: [] };
    const saved = await api.save({ expectedRevision: 0, content });
    expect(saved.revision).toBe(1);
    expect((await api.read()).revision).toBe(1);
    expect((await api.read()).clubs).toHaveLength(0);
  });

  it('版本冲突抛出 REVISION_CONFLICT 且不改变内容', async () => {
    const api = createMockPublicContentApi({ initial: base() });
    await expect(
      api.save({ expectedRevision: 5, content: { clubs: [], activities: [] } }),
    ).rejects.toMatchObject({ error: { code: 'REVISION_CONFLICT' } });
    expect((await api.read()).revision).toBe(0);
    expect((await api.read()).clubs).toHaveLength(1);
  });

  it('内容校验失败抛出 INVALID_CONTENT 且不改变内容', async () => {
    const api = createMockPublicContentApi({ initial: base() });
    const content: PublicContent = {
      clubs: [{ id: 'c1', name: '足球协会', category: '', summary: '', campusIds: [], links: [] }],
      activities: [{
        id: 'a1', name: 'x', organizerClubId: '不存在', category: '',
        startsAt: '2026-09-27T00:00:00Z', endsAt: '2026-09-27T01:00:00Z',
        campusId: null, venue: '', description: '', links: [],
      }],
    };
    await expect(api.save({ expectedRevision: 0, content })).rejects.toMatchObject({
      error: { code: 'INVALID_CONTENT' },
    });
    expect((await api.read()).revision).toBe(0);
  });
});
