import type { Course } from './model';

export type CommunityCourse = Course & {
  contributorCount: number;
};

export type CommunitySnapshot = {
  updatedAt: string;
  termId: string;
  contributorCount: number;
  courses: CommunityCourse[];
};

const INSTALLATION_KEY = 'csu-campus-schedule-installation';
const SHARING_KEY = 'csu-campus-schedule-sharing';

export function getInstallationId() {
  const stored = window.localStorage.getItem(INSTALLATION_KEY);
  if (stored) return stored;
  const id = window.crypto.randomUUID();
  window.localStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

export function getSharingEnabled() {
  return window.localStorage.getItem(SHARING_KEY) !== 'off';
}

export function setSharingEnabled(enabled: boolean) {
  window.localStorage.setItem(SHARING_KEY, enabled ? 'on' : 'off');
}

async function readResponse(response: Response) {
  const body = await response.json() as CommunitySnapshot | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    throw new Error(errorBody.error?.message || '共享课池请求失败。');
  }
  const snapshot = body as CommunitySnapshot;
  if (Array.isArray(snapshot.courses)) {
    snapshot.courses = snapshot.courses.map((course) => ({
      ...course,
      buildingName: course.buildingName || '',
      weekExpression: course.weekExpression || '',
      notes: '',
      color: course.color || null,
      source: 'community',
      createdAt: course.createdAt || snapshot.updatedAt,
      updatedAt: course.updatedAt || snapshot.updatedAt,
    }));
  }
  return snapshot;
}

export async function loadCommunityCourses(termId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/community-courses?termId=${encodeURIComponent(termId)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  return readResponse(response);
}

export async function syncCommunityCourses(courses: Course[], termId: string) {
  const response = await fetch(`/api/community-schedules/${getInstallationId()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ termId, courses }),
  });
  return readResponse(response);
}

export async function withdrawCommunityCourses() {
  const response = await fetch(`/api/community-schedules/${getInstallationId()}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || '撤回共享课表失败。');
  }
}
