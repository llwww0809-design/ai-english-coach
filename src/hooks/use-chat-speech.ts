'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { speechText } from '@/lib/speech-text';
import { getChatAudio, primeChatAudio } from '@/lib/chat-audio';
import { defaultVoice, isTtsVoice, type TtsVoice } from '@/lib/tts-voices';

const KEY = 'english-coach.auto-tts.v1';
const VOICE_KEY = 'english-coach.tts-voice.v1';
const CHANGE = 'english-coach-auto-tts-change';
type SpokenMessage = { id: number; content: string };

export function useChatSpeech(onNotice: (text: string) => void) {
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState(false);
  const [voice, setVoice] = useState<TtsVoice>(defaultVoice);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const enabledRef = useRef(true);
  const voiceRef = useRef<TtsVoice>(defaultVoice);
  const noticeRef = useRef(onNotice); noticeRef.current = onNotice;
  const playing = useRef<number | null>(null);
  const token = useRef(0);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);

  const stop = useCallback(() => {
    token.current++;
    request.current?.abort(); request.current = null;
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      const player = getChatAudio(); player.onended = null; player.onerror = null;
      player.pause(); player.removeAttribute('src'); player.load();
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null; playing.current = null; setSpeakingId(null);
  }, []);

  useEffect(() => {
    setAvailable(typeof Audio !== 'undefined');
    const load = () => {
      try {
        const next = localStorage.getItem(KEY) !== 'false';
        const storedVoice = localStorage.getItem(VOICE_KEY);
        const nextVoice = isTtsVoice(storedVoice) ? storedVoice : defaultVoice;
        if (!next || nextVoice !== voiceRef.current) stop();
        enabledRef.current = next; setEnabled(next); voiceRef.current = nextVoice; setVoice(nextVoice);
      } catch { /* Preserve in-memory settings when storage is blocked. */ }
    };
    load();
    const storage = (event: StorageEvent) => { if ([KEY, VOICE_KEY, null].includes(event.key)) load(); };
    window.addEventListener('storage', storage); window.addEventListener(CHANGE, load); window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('storage', storage); window.removeEventListener(CHANGE, load); window.removeEventListener('pagehide', stop); stop(); };
  }, [stop]);

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
    try {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: voiceRef.current }), signal: controller.signal });
      if (!response.ok) throw new Error('TTS request failed');
      const blob = await response.blob();
      if (controller.signal.aborted || generation !== token.current) return;
      if (!blob.size || !response.headers.get('content-type')?.includes('audio/mpeg')) throw new Error('Invalid TTS audio');
      const player = getChatAudio();
      objectUrl.current = URL.createObjectURL(blob); player.src = objectUrl.current;
      player.onended = () => { if (token.current !== generation) return; stop(); noticeRef.current('朗读完成。'); };
      player.onerror = () => { if (token.current !== generation) return; stop(); noticeRef.current('音频播放失败，请点击小喇叭重试。'); };
      await player.play();
      if (generation === token.current) noticeRef.current('正在朗读 · 点击小喇叭可停止');
    } catch (error) {
      if (controller.signal.aborted || generation !== token.current) return;
      stop();
      noticeRef.current(error instanceof Error && error.name === 'NotAllowedError' ? 'Safari 暂未允许自动播放，请点击回复旁的小喇叭。' : '微软语音暂不可用，请检查网络或点击小喇叭重试。');
    } finally { if (request.current === controller) request.current = null; }
  }, [stop]);

  function toggle() {
    const next = !enabledRef.current; enabledRef.current = next; setEnabled(next);
    if (next) prepare(); else stop();
    try { localStorage.setItem(KEY, String(next)); window.dispatchEvent(new Event(CHANGE)); noticeRef.current(next ? '自动发音已开启。' : '自动发音已关闭，仍可点击小喇叭朗读。'); }
    catch { noticeRef.current('设置仅对当前页面生效，浏览器暂时无法保存偏好。'); }
  }
  function selectVoice(value: string) {
    if (!isTtsVoice(value)) return;
    stop(); voiceRef.current = value; setVoice(value);
    try { localStorage.setItem(VOICE_KEY, value); window.dispatchEvent(new Event(CHANGE)); noticeRef.current('音色已切换，下次朗读生效。'); }
    catch { noticeRef.current('音色已切换，但浏览器暂时无法保存偏好。'); }
  }
  return { enabled, available, voice, selectVoice, speakingId, stop, prepare, toggle, speak: (message: SpokenMessage) => { void play(message); }, autoSpeak: (message: SpokenMessage) => { void play(message, true); } };
}
