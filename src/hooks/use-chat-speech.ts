'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechText } from '@/lib/speech-text';
import { getChatAudio, primeChatAudio } from '@/lib/chat-audio';
import { playSpeechSource, speakBrowser, stopBrowserSpeech } from '@/lib/browser-speech';
import { useUserLevel } from './use-user-level';
import { AUTO_TTS_EVENT, AUTO_TTS_KEY } from '@/lib/speech-preferences';

type SpokenMessage = { id: number; content: string };

export function useChatSpeech(onNotice: (text: string) => void) {
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(false);
  const { level } = useUserLevel();
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const enabledRef = useRef(true);
  const noticeRef = useRef(onNotice); noticeRef.current = onNotice;
  const playing = useRef<number | null>(null);
  const token = useRef(0);
  const request = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    token.current++;
    stopBrowserSpeech();
    request.current?.abort(); request.current = null;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const player = getChatAudio(); player.onended = null; player.onerror = null;
      player.pause();
    }
    playing.current = null; setSpeakingId(null);
  }, []);

  useEffect(() => {
    setAvailable(typeof Audio !== 'undefined');
    const load = () => {
      try {
        const next = localStorage.getItem(AUTO_TTS_KEY) !== 'false';
        if (!next) stop();
        enabledRef.current = next; setEnabled(next);
      } catch { /* Preserve in-memory settings when storage is blocked. */ }
    };
    load();
    const storage = (event: StorageEvent) => { if ([AUTO_TTS_KEY, null].includes(event.key)) load(); };
    window.addEventListener('storage', storage); window.addEventListener(AUTO_TTS_EVENT, load); window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(AUTO_TTS_EVENT, load); window.removeEventListener('pagehide', stop); stop(); };
  }, [stop]);

  useEffect(() => { stop(); }, [level, stop]);

  const prepare = useCallback(() => {
    stop();
    if (enabledRef.current && typeof Audio !== 'undefined') {
      try { primeChatAudio(); } catch { /* Manual replay remains available. */ }
    }
  }, [stop]);

  const play = useCallback(async (message: SpokenMessage, automatic = false) => {
    if (automatic && (!enabledRef.current || document.visibilityState === 'hidden')) return;
    if (typeof Audio === 'undefined') { noticeRef.current('当前浏览器不支持音频播放，可以继续文字练习。'); return; }
    if (!automatic && playing.current === message.id) { stop(); noticeRef.current('已停止朗读。'); return; }
    const text = speechText(message.content);
    if (!/[A-Za-z]/.test(text)) return;
    stop();
    const generation = token.current;
    if (!automatic) { try { primeChatAudio(); } catch { /* Continue with the MP3. */ } }
    const controller = new AbortController(); request.current = controller;
    playing.current = message.id; setSpeakingId(message.id);
    noticeRef.current('正在生成自然语音…点击小喇叭可取消');
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (controller.signal.aborted || generation !== token.current) return;
      const player = getChatAudio(); player.onerror = null; player.onended = null; player.pause();
      playing.current = null; setSpeakingId(null);
      noticeRef.current('正在使用设备语音朗读');
      speakBrowser(text, () => { if (generation === token.current) { stop(); noticeRef.current(''); } }, () => { if (generation === token.current) { stop(); noticeRef.current('设备语音不可用，请检查系统英语语音设置后再点朗读。'); } });
    };
    try {
      const player = getChatAudio();
      player.onended = () => { if (token.current !== generation) return; stop(); noticeRef.current('朗读完成。'); };
      player.onerror = fallback;
      await playSpeechSource(player, text, controller.signal);
      if (generation === token.current && !fallbackStarted) noticeRef.current('正在朗读 · 点击小喇叭可停止');
    } catch (error) {
      if (controller.signal.aborted || generation !== token.current) return;
      fallback();
    } finally { if (request.current === controller) request.current = null; }
  }, [stop]);

  function toggle() {
    const next = !enabledRef.current; enabledRef.current = next; setEnabled(next);
    if (next) prepare(); else stop();
    try { localStorage.setItem(AUTO_TTS_KEY, String(next)); window.dispatchEvent(new Event(AUTO_TTS_EVENT)); noticeRef.current(next ? '自动发音已开启。' : '自动发音已关闭，仍可点击小喇叭朗读。'); }
    catch { noticeRef.current('设置仅对当前页面生效，浏览器暂时无法保存偏好。'); }
  }
  return { enabled, available, level, speakingId, stop, prepare, toggle, speak: (message: SpokenMessage) => { void play(message); }, autoSpeak: (message: SpokenMessage) => { void play(message, true); } };
}
