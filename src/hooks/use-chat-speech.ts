'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechText } from '@/lib/speech-text';

const KEY = 'english-coach.auto-tts.v1';
const CHANGE = 'english-coach-auto-tts-change';
type SpokenMessage = { id: number; content: string };

export function useChatSpeech(onNotice: (text: string) => void) {
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const enabledRef = useRef(true);
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const playing = useRef<number | null>(null);
  const token = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    token.current++;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    current.current = null; playing.current = null; setSpeakingId(null);
  }, []);

  useEffect(() => {
    setAvailable('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function');
    const load = () => {
      try { const next = localStorage.getItem(KEY) !== 'false'; enabledRef.current = next; setEnabled(next); if (!next) stop(); }
      catch { /* Keep the in-memory preference when storage is unavailable. */ }
    };
    load();
    const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) load(); };
    window.addEventListener('storage', storage); window.addEventListener(CHANGE, load); window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(CHANGE, load); window.removeEventListener('pagehide', stop); stop(); };
  }, [stop]);

  // Call synchronously from a send/stop-microphone tap. Safari's unlock is best effort;
  // SpeechSynthesis has no standard persistent permission/unlock API.
  const prepare = useCallback(() => {
    stop();
    if (!enabledRef.current || typeof window === 'undefined' || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') return;
    try {
      const warmup = new SpeechSynthesisUtterance('Ready');
      warmup.lang = 'en-US'; warmup.volume = 0;
      current.current = warmup;
      window.speechSynthesis.resume(); window.speechSynthesis.speak(warmup);
    } catch { /* Manual playback remains available if Safari rejects the warmup. */ }
  }, [stop]);

  const play = useCallback((message: SpokenMessage, automatic = false) => {
    if (automatic && (!enabledRef.current || document.visibilityState === 'hidden')) return;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') { noticeRef.current('当前浏览器不支持语音朗读，可以继续文字练习。'); return; }
    if (!automatic && playing.current === message.id) { stop(); noticeRef.current('已停止朗读。'); return; }
    const text = speechText(message.content);
    if (!/[A-Za-z]/.test(text)) return;
    stop(); const generation = token.current;
    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US'; utterance.rate = .95;
      const voice = synth.getVoices().find(item => item.lang.replace('_', '-').toLowerCase() === 'en-us');
      if (voice) utterance.voice = voice;
      current.current = utterance;
      const clearWatchdog = () => { if (watchdog.current) clearTimeout(watchdog.current); watchdog.current = null; };
      utterance.onstart = () => { if (token.current !== generation) return; clearWatchdog(); noticeRef.current('正在朗读 · 点击小喇叭可停止'); };
      utterance.onend = () => { if (token.current !== generation) return; clearWatchdog(); current.current = null; playing.current = null; setSpeakingId(null); noticeRef.current('朗读完成。'); };
      utterance.onerror = () => { if (token.current !== generation) return; stop(); noticeRef.current('自动发音或设备语音暂不可用，请点击回复旁的小喇叭重试。'); };
      playing.current = message.id; setSpeakingId(message.id);
      watchdog.current = setTimeout(() => { if (token.current !== generation) return; stop(); noticeRef.current('语音未能启动，请点击回复旁的小喇叭播放。'); }, 6000);
      synth.resume(); synth.speak(utterance);
    } catch { stop(); noticeRef.current('朗读暂不可用，请点击回复旁的小喇叭重试。'); }
  }, [stop]);

  function toggle() {
    const next = !enabledRef.current;
    enabledRef.current = next; setEnabled(next);
    if (next) prepare(); else stop();
    try { localStorage.setItem(KEY, String(next)); window.dispatchEvent(new Event(CHANGE)); noticeRef.current(next ? '自动发音已开启，下条完整回复将自动朗读。' : '自动发音已关闭，仍可点击小喇叭朗读。'); }
    catch { noticeRef.current('设置仅对当前页面生效，浏览器暂时无法保存偏好。'); }
  }
  return { enabled, available, speakingId, stop, prepare, toggle, speak: (message: SpokenMessage) => play(message), autoSpeak: (message: SpokenMessage) => play(message, true) };
}
