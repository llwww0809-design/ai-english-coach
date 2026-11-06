'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatAudio, primeChatAudio } from '@/lib/chat-audio';
import type { SlowArticle } from '@/lib/listening-storage';

type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'finished';
type Track = { url: string; times: number[] };

/** One continuous article track avoids network requests between sentences in the background. */
export function useListeningAudio(article: SlowArticle) {
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(article.audioSpeed);
  const [state, setState] = useState<AudioState>('idle');
  const [error, setError] = useState('');
  const status = useRef<AudioState>('idle');
  const currentIndex = useRef(0);
  const currentSpeed = useRef(article.audioSpeed);
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, Track>());
  const activeTrack = useRef('');
  const ownsAudio = useRef(false);
  const sentenceTimes = useRef<number[]>([]);
  const controls = useRef({ resume: () => {}, pause: () => {}, previous: () => {}, next: () => {} });
  function updateState(value: AudioState) { status.current = value; setState(value); }
  const halt = useCallback(() => {
    sequence.current++; controller.current?.abort(); controller.current = null;
    if (status.current === 'loading') activeTrack.current = '';
    if (ownsAudio.current) getChatAudio().pause();
  }, []);
  const pause = useCallback(() => { halt(); status.current = 'paused'; setState('paused'); }, [halt]);

  useEffect(() => () => {
    halt();
    if (ownsAudio.current) {
      const audio = getChatAudio();
      audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null;
      audio.onplay = null; audio.onpause = null; audio.removeAttribute('src'); audio.load();
    }
    cache.current.forEach(track => URL.revokeObjectURL(track.url)); cache.current.clear();
  }, [halt]);

  function timesFor(duration: number) {
    if (sentenceTimes.current.length === article.sentences.length) return sentenceTimes.current;
    // Older providers may omit boundaries; use weighted estimates only as a fallback.
    const weights = article.sentences.map(sentence => Math.max(1, sentence.en.split(/\s+/).length));
    const total = weights.reduce((sum, count) => sum + count, 0);
    let elapsed = 0;
    return weights.map(weight => { const at = elapsed / total * duration; elapsed += weight; return at; });
  }
  function sync() {
    if (!activeTrack.current.startsWith('article:')) return;
    const audio = getChatAudio();
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    const times = timesFor(audio.duration);
    let at = 0;
    for (let i = 0; i < times.length; i++) if (audio.currentTime >= times[i]) at = i;
    if (currentIndex.current !== at) { currentIndex.current = at; setIndex(at); }
    if (typeof navigator !== 'undefined' && navigator.mediaSession?.setPositionState) {
      try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.duration, audio.currentTime), playbackRate: audio.playbackRate }); } catch { /* Optional on older Safari. */ }
    }
  }

  async function start(at: number, gesture: boolean, previewText?: string) {
    if (!previewText) { currentIndex.current = at; setIndex(at); }
    const key = previewText ? 'preview:' + previewText : 'article:' + article.id + ':' + currentSpeed.current;
    if (status.current === 'loading' && activeTrack.current === key) return;
    halt();
    const token = sequence.current;
    ownsAudio.current = true;
    const audio = getChatAudio();
    audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null; audio.onplay = null; audio.onpause = null;
    if (gesture) primeChatAudio();
    activeTrack.current = key;
    updateState('loading'); setError('');
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 40000);
    try {
      let track = cache.current.get(key);
      if (!track) {
        const sentences = article.sentences.map(sentence => sentence.en);
        const response = await fetch('/api/tts', { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: previewText || sentences.join(' '), ...(!previewText ? { sentences } : {}), voice: 'en-US-JennyNeural', level: article.level, mode: 'listening', speed: currentSpeed.current }) });
        if (!response.ok) throw new Error('Jenny 语音暂不可用，请再试一次。');
        const blob = await response.blob();
        if (sequence.current !== token || abort.signal.aborted) return;
        if (!blob.size) throw new Error('语音返回为空，请重试。');
        let times: number[] = [];
        try {
          const raw: unknown = JSON.parse(response.headers.get('X-Sentence-Times') || '[]');
          if (Array.isArray(raw) && raw.length === sentences.length && raw.every((value, i) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && (i === 0 || value >= raw[i - 1]))) times = raw;
        } catch { /* Keep playback available even without provider timing metadata. */ }
        track = { url: URL.createObjectURL(blob), times }; cache.current.set(key, track);
      }
      if (sequence.current !== token || abort.signal.aborted) return;
      sentenceTimes.current = track.times;
      audio.src = track.url; audio.playbackRate = 1;
      const seek = () => {
        if (sequence.current !== token || previewText) return;
        const duration = audio.duration;
        if (Number.isFinite(duration) && duration > 0) audio.currentTime = Math.min(timesFor(duration)[currentIndex.current] || 0, duration);
      };
      audio.onloadedmetadata = seek;
      if (audio.readyState >= 1) seek();
      audio.ontimeupdate = sync;
      audio.onended = () => { if (sequence.current === token) updateState(previewText ? 'paused' : 'finished'); };
      audio.onerror = () => { if (sequence.current === token) { activeTrack.current = ''; pause(); setError('音频播放失败，请点击播放重试。'); } };
      audio.onplay = () => { if (sequence.current === token) updateState('playing'); };
      audio.onpause = () => { if (sequence.current === token && !audio.ended && status.current === 'playing') updateState('paused'); };
      await audio.play();
      if (sequence.current === token) updateState('playing');
    } catch (cause) {
      if (sequence.current !== token) return;
      activeTrack.current = ''; updateState('paused');
      setError(abort.signal.aborted ? '语音准备超时，请点击播放重试。' : cause instanceof Error && cause.name === 'NotAllowedError' ? '请再点一次播放，允许浏览器发声。' : cause instanceof Error ? cause.message : '暂时无法播放。');
    } finally { window.clearTimeout(timeout); if (controller.current === abort) controller.current = null; }
  }

  function playAt(at: number, gesture = true) {
    const bounded = Math.max(0, Math.min(article.sentences.length - 1, at));
    currentIndex.current = bounded; setIndex(bounded);
    const audio = ownsAudio.current ? getChatAudio() : null;
    if (activeTrack.current === 'article:' + article.id + ':' + currentSpeed.current && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = timesFor(audio.duration)[bounded] || 0;
      if (status.current === 'finished') updateState('paused');
      void resume();
    } else void start(bounded, gesture);
  }
  async function resume() {
    if (status.current === 'loading' || status.current === 'playing') return;
    if (status.current !== 'finished' && activeTrack.current.startsWith('article:') && ownsAudio.current && getChatAudio().src) {
      const token = sequence.current;
      // Pause invalidates pending work; install fresh callbacks when resuming the same track.
      const audio = getChatAudio();
      audio.onended = () => { if (sequence.current === token) updateState('finished'); };
      audio.onplay = () => { if (sequence.current === token) updateState('playing'); };
      audio.onpause = () => { if (sequence.current === token && !audio.ended) updateState('paused'); };
      audio.onerror = () => { if (sequence.current === token) { activeTrack.current = ''; pause(); setError('音频播放失败，请重试。'); } };
      try { await audio.play(); if (sequence.current === token) { updateState('playing'); setError(''); } }
      catch { if (sequence.current === token) { updateState('paused'); setError('请再点一次播放。'); } }
    } else {
      const at = status.current === 'finished' ? 0 : currentIndex.current;
      currentIndex.current = at; setIndex(at); await start(at, true);
    }
  }
  async function toggle() { if (status.current === 'loading') return; if (status.current === 'playing') pause(); else await resume(); }
  function changeSpeed(value: number) {
    if (value === currentSpeed.current) return;
    const wasPlaying = status.current === 'playing';
    halt(); activeTrack.current = ''; currentSpeed.current = value; setSpeed(value); updateState('paused');
    if (wasPlaying) void start(currentIndex.current, true);
  }
  function preview(text: string) { if (status.current !== 'loading') void start(0, true, text); }
  controls.current = { resume: () => { void resume(); }, pause, previous: () => playAt(currentIndex.current - 1, false), next: () => playAt(currentIndex.current + 1, false) };

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    const session = navigator.mediaSession;
    if (typeof MediaMetadata !== 'undefined') session.metadata = new MediaMetadata({ title: article.titleEn, artist: 'Jenny 美音 · ' + article.level, album: 'Slow English 慢速听读', artwork: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    const actions: MediaSessionAction[] = ['play', 'pause', 'previoustrack', 'nexttrack'];
    const handlers = [() => controls.current.resume(), () => controls.current.pause(), () => controls.current.previous(), () => controls.current.next()];
    actions.forEach((action, i) => { try { session.setActionHandler(action, handlers[i]); } catch { /* Some browsers support only play/pause. */ } });
    return () => { actions.forEach(action => { try { session.setActionHandler(action, null); } catch {} }); session.metadata = null; session.playbackState = 'none'; try { session.setPositionState?.(); } catch {} };
  }, [article.id, article.titleEn, article.level]);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaSession) navigator.mediaSession.playbackState = state === 'playing' ? 'playing' : state === 'paused' || state === 'loading' ? 'paused' : 'none';
  }, [state]);
  return { index, speed, state, error, pause, toggle, playAt, changeSpeed, preview };
}
