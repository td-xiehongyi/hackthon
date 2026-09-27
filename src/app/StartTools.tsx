import { useRef, useState, type FormEvent } from 'react';
import type { CampusProfile } from './campus-profile';
import { useMusicSettings } from './BackgroundMusic';

interface Props {
  profile: CampusProfile | null;
  onProfileChange: (profile: CampusProfile | null) => void;
}

const EMPTY_PROFILE: CampusProfile = { name: '', college: '', studentId: '' };

export default function StartTools({ profile, onProfileChange }: Props) {
  const profileDialog = useRef<HTMLDialogElement>(null);
  const openMusicSettings = useMusicSettings();
  const [draft, setDraft] = useState<CampusProfile>(EMPTY_PROFILE);
  const [error, setError] = useState('');

  function openProfile() {
    setDraft(profile ? { ...profile } : { ...EMPTY_PROFILE });
    setError('');
    profileDialog.current?.showModal();
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { name: draft.name.trim(), college: draft.college.trim(), studentId: draft.studentId.trim() };
    if (!next.name || !next.college) { setError('请填写姓名和学院。'); return; }
    try {
      onProfileChange(next);
      profileDialog.current?.close();
    } catch { setError('当前浏览器无法保存资料，请允许本机存储后重试。'); }
  }

  function logout() {
    try {
      onProfileChange(null);
      profileDialog.current?.close();
    } catch { setError('当前浏览器无法清除资料，请稍后重试。'); }
  }

  return <>
    <div className="start-tools">
      <button type="button" className="start-profile-trigger" aria-label={profile ? '编辑个人信息' : '登录'} title={profile ? `${profile.name} · 编辑个人信息` : '登录 · 填写个人信息'} onClick={openProfile}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></svg>
        {profile && <span className="start-profile-dot" aria-hidden="true" />}
      </button>
      <button type="button" aria-label="背景音乐" title="背景音乐与音量" onClick={openMusicSettings}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2.5" /><ellipse cx="17" cy="16" rx="3" ry="2.5" /></svg>
      </button>
    </div>
    <dialog ref={profileDialog} className="start-dialog start-profile-dialog" aria-labelledby="profile-dialog-title">
      <header><h2 id="profile-dialog-title">{profile ? '个人信息' : '校园登录'}</h2><button type="button" aria-label="关闭个人信息" onClick={() => profileDialog.current?.close()}>×</button></header>
      <p className="start-profile-intro">填写你的校园资料，让漫游从认识你开始。</p>
      <form className="start-profile-form" onSubmit={save}>
        <label>姓名<input autoFocus name="name" autoComplete="name" required maxLength={30} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="怎么称呼你" /></label>
        <label>学院<input name="college" required maxLength={60} value={draft.college} onChange={e => setDraft({ ...draft, college: e.target.value })} placeholder="填写所在学院" /></label>
        <label>学号（选填）<input name="studentId" autoComplete="off" maxLength={30} value={draft.studentId} onChange={e => setDraft({ ...draft, studentId: e.target.value })} placeholder="也可以暂时留空" /></label>
        <p className="start-profile-note">资料仅保存在当前浏览器，用于校园内的个人信息卡。</p>
        {error && <p className="start-profile-error" role="alert">{error}</p>}
        <div className="start-profile-actions">
          {profile && <button type="button" onClick={logout}>退出登录</button>}
          <button type="submit" className="start-profile-save">{profile ? '保存修改' : '保存并登录'}</button>
        </div>
      </form>
    </dialog>
  </>;
}
