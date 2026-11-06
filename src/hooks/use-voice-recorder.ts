'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'requesting' | 'recording' | 'transcribing';
type Take = { token: number; held: boolean; cancelled: boolean; startY: number; startedAt: number; stream?: MediaStream; recorder?: MediaRecorder; timer?: ReturnType<typeof setTimeout> };

export function useVoiceRecorder(onText: (text: string) => void, onPrepare: () => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const take = useRef<Take | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const callbacks = useRef({ onText, onPrepare }); callbacks.current = { onText, onPrepare };
  const release = (item: Take) => { clearTimeout(item.timer); item.stream?.getTracks().forEach(track => track.stop()); };
  const cancel = useCallback(() => {
    generation.current++; request.current?.abort(); request.current = null;
    const item = take.current; take.current = null;
    if (item) { item.cancelled = true; item.held = false; if (item.recorder?.state === 'recording') item.recorder.stop(); release(item); }
    setPhase('idle'); setCancelling(false);
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', cancel);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', cancel); cancel(); };
  }, [cancel]);

  const finish = useCallback((forceCancel = false) => {
    const item = take.current;
    if (!item || !item.held) return;
    item.held = false; item.cancelled ||= forceCancel;
    clearTimeout(item.timer); setCancelling(false);
    if (!item.recorder) { cancel(); return; } // Released while the permission sheet was open.
    if (item.cancelled || Date.now() - item.startedAt < 350) {
      if (!item.cancelled) setError('说话时间太短，请按住再试一次。');
      cancel(); return;
    }
    setPhase('transcribing');
    if (item.recorder.state === 'recording') item.recorder.stop();
  }, [cancel]);

  const start = useCallback(async (y: number) => {
    if (take.current || request.current) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('当前浏览器不支持录音，请使用新版 Safari / Chrome 或文字输入。'); return; }
    callbacks.current.onPrepare();
    const item: Take = { token: ++generation.current, held: true, cancelled: false, startY: y, startedAt: 0 };
    take.current = item; setPhase('requesting'); setCancelling(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      item.stream = stream;
      if (take.current !== item || !item.held || item.cancelled) { release(item); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      item.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { if (generation.current === item.token) { cancel(); setError('录音中断，请重新按住说话。'); } };
      recorder.onstop = async () => {
        release(item);
        if (item.cancelled || generation.current !== item.token) return;
        take.current = null; setPhase('transcribing');
        const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        if (!blob.size || blob.size > 4 * 1024 * 1024) { setPhase('idle'); setError('录音无效或过长，请重新录制。'); return; }
        const controller = new AbortController(); request.current = controller;
        const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const body = new FormData(); body.set('file', blob, blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
          const response = await fetch('/api/stt', { method: 'POST', body, signal: controller.signal });
          const result = await response.json();
          if (!response.ok || typeof result.text !== 'string' || !result.text.trim()) throw new Error(result.error || '没有听清，请重试。');
          if (generation.current === item.token) callbacks.current.onText(result.text.trim());
        } catch (cause) {
          if (generation.current === item.token) setError(controller.signal.aborted ? '识别超时，请重试或使用文字输入。' : cause instanceof Error ? cause.message : '语音识别失败，请重试。');
        } finally {
          clearTimeout(timer);
          if (request.current === controller) request.current = null;
          if (generation.current === item.token) setPhase('idle');
        }
      };
      item.startedAt = Date.now(); recorder.start();
      setPhase('recording');
      try { navigator.vibrate?.(50); } catch { /* Haptics are optional. */ }
      item.timer = setTimeout(() => finish(), 60000);
    } catch (cause) {
      release(item);
      if (generation.current !== item.token) return;
      take.current = null; setPhase('idle'); setCancelling(false);
      setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? '请允许麦克风权限，然后重新按住说话。' : '无法使用麦克风，请检查权限或改用文字输入。');
    }
  }, [cancel, finish]);
  const move = useCallback((y: number) => {
    const item = take.current;
    if (!item?.held) return;
    item.cancelled = item.startY - y > 70;
    setCancelling(item.cancelled);
  }, []);
  return { phase, cancelling, error, start, move, finish, cancel };
}
