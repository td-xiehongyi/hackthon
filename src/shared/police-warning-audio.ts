/** React 跑步页和 Phaser 南门共用音频请求，实际播放由全局播放器管理。 */
export const POLICE_WARNING_AUDIO_EVENT = 'csu:police-warning-audio';
export interface PoliceWarningAudioRequest { id: symbol; action: 'play' | 'stop' }

export function playPoliceWarning(): () => void {
  const id = Symbol('police-warning');
  const send = (action: PoliceWarningAudioRequest['action']) => {
    window.dispatchEvent(new CustomEvent<PoliceWarningAudioRequest>(POLICE_WARNING_AUDIO_EVENT, { detail: { id, action } }));
  };
  send('play');
  return () => send('stop');
}
