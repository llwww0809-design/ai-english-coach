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
  audio.src = '/api/tts?' + new URLSearchParams({ text, speed: String(speed) }).toString();
  audio.playbackRate = speed;
  return startSpeechPlayback(audio, signal);
}
