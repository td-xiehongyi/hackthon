export interface CampusProfile {
  name: string;
  college: string;
  studentId: string;
}

const PROFILE_KEY = 'csu-campus-profile';

export function readCampusProfile(): CampusProfile | null {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (!value || typeof value.name !== 'string' || typeof value.college !== 'string' || typeof value.studentId !== 'string') return null;
    const profile = { name: value.name.trim(), college: value.college.trim(), studentId: value.studentId.trim() };
    if (!profile.name || !profile.college || profile.name.length > 30 || profile.college.length > 60 || profile.studentId.length > 30) return null;
    return profile;
  } catch { return null; }
}

/** 只保存本浏览器个人资料，不发送到服务端。保存失败交给表单提示。 */
export function saveCampusProfile(profile: CampusProfile | null): void {
  if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(PROFILE_KEY);
}
