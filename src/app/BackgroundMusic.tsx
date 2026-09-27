import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { POLICE_WARNING_AUDIO_EVENT, type PoliceWarningAudioRequest } from '../shared/police-warning-audio';
import './background-music.css';

const SETTINGS_KEY = 'csu-background-music';
const MusicContext = createContext<() => void>(() => {});
export const useMusicSettings = () => useContext(MusicContext);
const RunMusicContext = createContext<(active: boolean) => void>(() => {});

export function useCampusRunMusic(active: boolean) {
  const setRunMusic = useContext(RunMusicContext);
  useEffect(() => {
    setRunMusic(active);
    return () => setRunMusic(false);
  }, [active, setRunMusic]);
}

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    return {
      volume: typeof saved?.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.max(0, Math.min(100, saved.volume)) : 40,
      muted: saved?.muted === true,
    };
  } catch { return { volume: 40, muted: false }; }
}

export default function BackgroundMusic({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const warningAudio = useRef<HTMLAudioElement>(null);
  const warningId = useRef<symbol | null>(null);
  const [warningActive, setWarningActive] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const wantsPlayback = useRef(true);
  const [settings, setSettings] = useState(readSettings);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [runMusic, setRunMusic] = useState(false);

  function play() {
    wantsPlayback.current = true;
    const track = warningId.current ? warningAudio.current : audio.current;
    if (!track) return;
    if (track.error) { track.load(); setError(false); }
    void track.play().catch(() => { /* 浏览器要求用户手势时，等待下一次点击。 */ });
  }

  useEffect(() => {
    const track = audio.current!;
    setError(false);
    if (warningId.current) return;
    setPlaying(false);
    if (wantsPlayback.current) void track.play().catch(() => {});
  }, [runMusic]);

  useEffect(() => {
    for (const track of [audio.current!, warningAudio.current!]) {
      track.volume = settings.volume / 100;
      track.muted = settings.muted;
    }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 禁用存储时仍可调节本次音量。 */ }
  }, [settings]);

  const finishWarning = useCallback(() => {
    if (!warningId.current) return;
    warningId.current = null;
    warningAudio.current?.pause();
    setWarningActive(false);
    setPlaying(false);
    if (wantsPlayback.current) void audio.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    const onWarning = (event: Event) => {
      const { id, action } = (event as CustomEvent<PoliceWarningAudioRequest>).detail;
      if (action === 'stop') {
        if (warningId.current === id) finishWarning();
        return;
      }
      warningId.current = id;
      setWarningActive(true);
      setPlaying(false);
      audio.current!.pause();
      const clip = warningAudio.current!;
      clip.load();
      if (wantsPlayback.current) void clip.play().catch(() => {
        if (warningId.current === id) finishWarning();
      });
    };
    window.addEventListener(POLICE_WARNING_AUDIO_EVENT, onWarning);
    return () => window.removeEventListener(POLICE_WARNING_AUDIO_EVENT, onWarning);
  }, [finishWarning]);

  useEffect(() => {
    const background = audio.current!;
    const warning = warningAudio.current!;
    const unlock = () => {
      const track = warningId.current ? warning : background;
      if (wantsPlayback.current && track.paused && !track.error) void track.play().catch(() => {});
    };
    unlock();
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      background.pause();
      warning.pause();
    };
  }, []);

  function openSettings() {
    window.dispatchEvent(new Event('blur'));
    dialog.current?.showModal();
  }

  return <MusicContext.Provider value={openSettings}>
    <RunMusicContext.Provider value={setRunMusic}>{children}</RunMusicContext.Provider>
    <audio ref={audio} src={`${import.meta.env.BASE_URL}audio/${runMusic ? 'campus-run' : 'campus-background'}.mp3`} loop preload="auto"
      onPlay={() => { if (!warningId.current) setPlaying(true); }} onPause={() => { if (!warningId.current) setPlaying(false); }} onError={() => { setError(true); setPlaying(false); }} />
    <audio ref={warningAudio} src={`${import.meta.env.BASE_URL}audio/police-warning.wav`} preload="auto"
      onPlay={() => { if (warningId.current) setPlaying(true); }} onPause={() => { if (warningId.current) setPlaying(false); }} onEnded={finishWarning} onError={finishWarning} />
    <button className="music-floating" type="button" aria-label="背景音乐设置" title="背景音乐与音量" onClick={openSettings}>
      <span aria-hidden="true">♫</span> {settings.muted || settings.volume === 0 ? '静音' : `${settings.volume}%`}
    </button>
    <dialog ref={dialog} className="music-dialog" aria-labelledby="music-dialog-title" onKeyDown={event => event.stopPropagation()}>
      <header><h2 id="music-dialog-title">背景音乐</h2><button type="button" aria-label="关闭背景音乐" onClick={() => dialog.current?.close()}>×</button></header>
      <div className="music-art" aria-hidden="true">♫</div>
      <h3>{warningActive ? '警察提醒音' : runMusic ? '校园跑音乐' : '主页背景音乐'}</h3>
      <p role="status">{error ? '音乐加载失败，请点击播放重试。' : playing ? (warningActive ? '提醒结束后继续原来的音乐' : runMusic ? '跑步专属音乐 · 循环播放' : '全程循环播放 · 校园跑时切换专属音乐') : '点击播放，伴你漫游校园'}</p>
      <label className="music-volume" htmlFor="music-volume">音乐音量 <output>{settings.volume}%</output></label>
      <input id="music-volume" type="range" min="0" max="100" step="1" value={settings.volume}
        aria-label="音乐音量" onChange={event => setSettings({ ...settings, volume: Number(event.target.value) })} />
      <div className="music-actions">
        <button type="button" onClick={() => setSettings({ ...settings, muted: !settings.muted })}>{settings.muted ? '取消静音' : '静音'}</button>
        <button type="button" onClick={() => {
          if (playing) { wantsPlayback.current = false; audio.current?.pause(); warningAudio.current?.pause(); } else play();
        }}>{playing ? '暂停音乐' : '播放音乐'}</button>
      </div>
    </dialog>
  </MusicContext.Provider>;
}
