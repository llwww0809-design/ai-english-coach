'use client';

let current: SpeechSynthesisUtterance | null = null;
let revision = 0;
export function stopBrowserSpeech() {
  revision++;
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export function speakBrowser(text: string, onEnd: () => void, onError: () => void) {
  stopBrowserSpeech();
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { onError(); return; }
  const token = revision;
  try {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    current = utterance;
    utterance.lang = 'en-US'; utterance.rate = 0.9;
    const voice = synth.getVoices().find(item => item.lang.toLowerCase() === 'en-us');
    if (voice) utterance.voice = voice;
    utterance.onend = () => { if (revision === token) { current = null; onEnd(); } };
    utterance.onerror = () => { if (revision === token) { current = null; onError(); } };
    synth.resume(); synth.speak(utterance);
  } catch { if (revision === token) { current = null; onError(); } }
}
export class SpeechServiceError extends Error {
  constructor(message: string, public fallbackAllowed: boolean) { super(message); }
}
const playbackAttempts = new WeakMap<HTMLAudioElement, symbol>();

/** Bound media startup so a stalled network or blocked play cannot leave controls loading. */
export async function startSpeechPlayback(audio: HTMLAudioElement, signal: AbortSignal, startedAt = Date.now()) {
  if (signal.aborted) { audio.pause(); throw new DOMException('Playback cancelled', 'AbortError'); }
  const attempt = Symbol(); playbackAttempts.set(audio, attempt);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => reject(new DOMException('Playback cancelled', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    timer = setTimeout(() => reject(new SpeechServiceError('Audio startup exceeded 5000ms', true)), Math.max(0, 5000 - (Date.now() - startedAt)));
  });
  try {
    await Promise.race([audio.play(), deadline]);
    if (signal.aborted) throw new DOMException('Playback cancelled', 'AbortError');
  } catch (error) {
    if (playbackAttempts.get(audio) === attempt) audio.pause();
    if (!signal.aborted) console.warn('[TTS Playback] Media could not start; using device speech.', error);
    throw error;
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', cancel);
  }
}

/** Assign the remote source and call play before leaving the user's tap stack.
 * The media element owns downloading; never wait for fetch/blob before play(). */
export function playSpeechSource(audio: HTMLAudioElement, text: string, signal: AbortSignal, speed = 0.9) {
  if (signal.aborted) return Promise.reject(new DOMException('Playback cancelled', 'AbortError'));
  audio.loop = false;
  audio.muted = false;
  audio.volume = 1;
  const key = speechSourceUrl(text, speed);
  const cached = hotAudio.get(key);
  const previous = mediaUrls.get(audio);
  const source = cached ? URL.createObjectURL(cached) : key;
  audio.src = source;
  if (cached) mediaUrls.set(audio, source); else mediaUrls.delete(audio);
  if (previous) URL.revokeObjectURL(previous);
  audio.playbackRate = speed;
  playbackCacheCleanup.get(audio)?.();
  playbackCacheCleanup.delete(audio);
  if (!cached && typeof audio.addEventListener === 'function') {
    // The browser HTTP cache can satisfy this copy after the media has finished downloading.
    const completed = () => { void warmAudio(text, speed); };
    audio.addEventListener('ended', completed, { once: true, signal });
    playbackCacheCleanup.set(audio, () => audio.removeEventListener('ended', completed));
  }
  return startSpeechPlayback(audio, signal);
}


// Version covers voice/model/output settings so old provider audio cannot be reused.
const AUDIO_CACHE = 'coach-tts-sarah-turbo-stream-v1';
const hotAudio = new Map<string, Blob>();
const pendingAudio = new Map<string, Promise<void>>();
const mediaUrls = new WeakMap<HTMLAudioElement, string>();
const playbackCacheCleanup = new WeakMap<HTMLAudioElement, () => void>();
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_HOT_BYTES = 20 * 1024 * 1024;
let hotBytes = 0;
let prefetchActive = 0;
const prefetchQueue: Array<() => void> = [];

export function speechSourceUrl(text: string, speed = 0.9) {
  return '/api/tts?' + new URLSearchParams({ text: text.trim(), speed: String(speed), v: AUDIO_CACHE }).toString();
}
function rememberAudio(key: string, blob: Blob) {
  const previous = hotAudio.get(key);
  if (previous) hotBytes -= previous.size;
  hotAudio.delete(key); hotAudio.set(key, blob); hotBytes += blob.size;
  while (hotAudio.size > 32 || hotBytes > MAX_HOT_BYTES) {
    const oldest = hotAudio.keys().next().value;
    if (!oldest) break;
    hotBytes -= hotAudio.get(oldest)!.size; hotAudio.delete(oldest);
  }
}
async function persistentAudioCache() {
  try { return typeof caches !== 'undefined' ? await caches.open(AUDIO_CACHE) : null; }
  catch { return null; } // Private browsing and storage quota must not block speech.
}
async function warmAudio(text: string, speed: number) {
  const key = speechSourceUrl(text, speed);
  if (hotAudio.has(key)) return;
  if (pendingAudio.has(key)) return pendingAudio.get(key);
  const work = (async () => {
    const cache = await persistentAudioCache();
    const cached = await cache?.match(key).catch(() => undefined);
    if (cached) {
      const blob = await cached.blob();
      if (blob.size && blob.size <= MAX_AUDIO_BYTES && blob.type.includes('audio/mpeg')) {
        rememberAudio(key, blob); return;
      }
      await cache?.delete(key);
    }
    const response = await fetch(key, { signal: AbortSignal.timeout(20000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('audio/mpeg')) return;
    if (Number(response.headers.get('content-length')) > MAX_AUDIO_BYTES) return;
    const blob = await response.blob();
    if (!blob.size || blob.size > MAX_AUDIO_BYTES) return;
    rememberAudio(key, blob);
    if (cache) {
      try {
        await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - 60))) await cache.delete(old);
      } catch { /* Memory cache still works if disk storage is unavailable. */ }
    }
  })().catch(() => {}).finally(() => { pendingAudio.delete(key); });
  pendingAudio.set(key, work);
  return work;
}
function drainPrefetch() {
  while (prefetchActive < 2 && prefetchQueue.length) prefetchQueue.shift()!();
}
/** Idle-only, bounded, deduplicated prefetch. Returns a route/effect cleanup. */
export function prefetchSpeech(texts: string[], speed = 0.9) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let cancelled = false;
  const browser = window as Window & { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  const run = () => {
    if (cancelled || document.visibilityState === 'hidden' || navigator.onLine === false || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    for (const text of [...new Set(texts.map(value => value.trim()).filter(value => value.length > 0 && value.length <= 4000))].slice(0, 6)) {
      prefetchQueue.push(() => {
        if (cancelled) { drainPrefetch(); return; }
        prefetchActive++;
        void warmAudio(text, speed).finally(() => { prefetchActive--; drainPrefetch(); });
      });
    }
    drainPrefetch();
  };
  const idle = browser.requestIdleCallback?.(run, { timeout: 1500 });
  const timer = idle === undefined ? setTimeout(run, 250) : undefined;
  return () => { cancelled = true; if (idle !== undefined) browser.cancelIdleCallback?.(idle); clearTimeout(timer); };
}
