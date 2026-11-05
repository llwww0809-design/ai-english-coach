export const AUTO_TTS_KEY = 'english-coach.auto-tts.v1';
export const AUTO_TTS_EVENT = 'english-coach-auto-tts-change';

export function getAutoTtsEnabled(): boolean {
 if (typeof window === 'undefined') return true;
 try { return window.localStorage.getItem(AUTO_TTS_KEY) !== 'false'; }
 catch { return true; }
}

export function setAutoTtsEnabled(enabled: boolean): void {
 if (typeof window === 'undefined') return;
 window.localStorage.setItem(AUTO_TTS_KEY, String(enabled));
 window.dispatchEvent(new Event(AUTO_TTS_EVENT));
}
