import { describe, it, expect } from 'vitest';
import {
  activityStatus,
  filterActivities,
  filterClubs,
  formatTimeRange,
  parseContentJson,
  serializeContent,
  validateContent,
} from '../../../src/features/stadium/domain';
import type { Activity, Club } from '../../../src/features/stadium/types';

const clubs: Club[] = [
  { id: 'c1', name: '机器人协会', category: '科技学术', summary: '竞赛', campusIds: ['yuelushan', 'xiaoxiang'], links: [] },
  { id: 'c2', name: '足球协会', category: '体育竞技', summary: '训练', campusIds: ['lunan'], links: [] },
  { id: 'c3', name: '汉服社', category: '文化艺术', summary: '', campusIds: [], links: [] },
];

const activities: Activity[] = [
  {
    id: 'a1', name: '机器人展示', organizerClubId: 'c1', category: '科技学术',
    startsAt: '2026-09-26T00:00:00Z', endsAt: '2026-09-26T15:59:00Z',
    campusId: 'xiaoxiang', venue: '副场东侧', description: '', links: [],
  },
  {
    id: 'a2', name: '足球友谊赛', organizerClubId: 'c2', category: '体育竞技',
    startsAt: '2026-09-27T07:00:00Z', endsAt: '2026-09-27T09:00:00Z',
    campusId: 'lunan', venue: '副场足球场', description: '', links: [],
  },
];

describe('filterClubs', () => {
  it('按关键词匹配名称/简介/类别', () => {
    expect(filterClubs(clubs, { keyword: '机器人', category: '', campusId: '' }).map((c) => c.id)).toEqual(['c1']);
    expect(filterClubs(clubs, { keyword: '训练', category: '', campusId: '' }).map((c) => c.id)).toEqual(['c2']);
  });
  it('按类别筛选', () => {
    expect(filterClubs(clubs, { keyword: '', category: '文化艺术', campusId: '' }).map((c) => c.id)).toEqual(['c3']);
  });
  it('按校区筛选（空 campusIds 不匹配任何校区）', () => {
    expect(filterClubs(clubs, { keyword: '', category: '', campusId: 'xiaoxiang' }).map((c) => c.id)).toEqual(['c1']);
    expect(filterClubs(clubs, { keyword: '', category: '', campusId: 'yuelushan' }).map((c) => c.id)).toEqual(['c1']);
  });
});

describe('filterActivities', () => {
  it('按校区筛选', () => {
    expect(filterActivities(activities, { keyword: '', category: '', campusId: 'lunan', date: '' }).map((a) => a.id)).toEqual(['a2']);
  });
  it('按日期筛选（Asia/Shanghai 时区）', () => {
    // a1 在 2026-09-26（上海）内，a2 从 09-27 才开始
    expect(filterActivities(activities, { keyword: '', category: '', campusId: '', date: '2026-09-26' }).map((a) => a.id)).toEqual(['a1']);
    expect(filterActivities(activities, { keyword: '', category: '', campusId: '', date: '2026-09-27' }).map((a) => a.id)).toEqual(['a2']);
  });
  it('按关键词匹配地点', () => {
    expect(filterActivities(activities, { keyword: '东侧', category: '', campusId: '', date: '' }).map((a) => a.id)).toEqual(['a1']);
  });
});

describe('activityStatus', () => {
  it('区分未开始 / 进行中 / 已结束', () => {
    const before = new Date('2026-09-25T00:00:00Z');
    const during = new Date('2026-09-26T10:00:00Z');
    const after = new Date('2026-09-27T00:00:00Z');
    expect(activityStatus(activities[0], before)).toBe('upcoming');
    expect(activityStatus(activities[0], during)).toBe('ongoing');
    expect(activityStatus(activities[0], after)).toBe('ended');
  });
});

describe('validateContent', () => {
  it('主办社团不存在时报错', () => {
    const content = {
      clubs: [{ id: 'c1', name: '足球协会', category: '', summary: '', campusIds: [], links: [] }],
      activities: [{
        id: 'a1', name: 'x', organizerClubId: '不存在', category: '',
        startsAt: '2026-09-27T00:00:00Z', endsAt: '2026-09-27T01:00:00Z',
        campusId: null, venue: '', description: '', links: [],
      }],
    };
    const errors = validateContent(content);
    expect(errors.some((e) => e.path === 'activities[0].organizerClubId')).toBe(true);
  });
  it('开始时间不早于结束时间时报错', () => {
    const content = {
      clubs: [{ id: 'c1', name: '足球协会', category: '', summary: '', campusIds: [], links: [] }],
      activities: [{
        id: 'a1', name: 'x', organizerClubId: 'c1', category: '',
        startsAt: '2026-09-27T02:00:00Z', endsAt: '2026-09-27T01:00:00Z',
        campusId: null, venue: '', description: '', links: [],
      }],
    };
    const errors = validateContent(content);
    expect(errors.some((e) => e.path === 'activities[0].endsAt')).toBe(true);
  });
  it('非法链接与重复 ID 报错', () => {
    const content = {
      clubs: [
        { id: 'c1', name: '足球协会', category: '', summary: '', campusIds: [], links: [{ label: 'x', url: 'ftp://bad' }] },
        { id: 'c1', name: '重复', category: '', summary: '', campusIds: [], links: [] },
      ],
      activities: [],
    };
    const errors = validateContent(content);
    expect(errors.some((e) => e.path === 'clubs[0].links[0].url')).toBe(true);
    expect(errors.some((e) => e.path === 'clubs[1].id')).toBe(true);
  });
});

describe('import/export', () => {
  it('序列化后可再解析回原结构', () => {
    const content = { clubs, activities };
    const text = serializeContent(content);
    const parsed = parseContentJson(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.content.clubs).toHaveLength(clubs.length);
      expect(parsed.content.activities).toHaveLength(activities.length);
    }
  });
  it('非法 JSON 返回错误', () => {
    const parsed = parseContentJson('{not json');
    expect(parsed.ok).toBe(false);
  });
});

describe('formatTimeRange', () => {
  it('按 Asia/Shanghai 格式化（UTC+8）', () => {
    const s = formatTimeRange('2026-09-26T00:00:00Z', '2026-09-26T01:00:00Z');
    expect(s).toContain('08:00');
    expect(s).toContain('09:00');
  });
});
