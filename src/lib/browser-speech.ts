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
export function canFallbackSpeech(error: unknown) {
  return error instanceof SpeechServiceError && error.fallbackAllowed;
}
/** Fetch and body consumption share the same deadline; caller cancellation stays distinct. */
export async function fetchSpeech(text: string, signal: AbortSignal, options: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new SpeechServiceError('TTS request timeout after 8000ms', true));
      controller.abort();
    }, 8000);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ speed: 0.9, ...options, text }) });
      if (response.status !== 200) throw new SpeechServiceError('TTS unavailable: ' + response.status, true);
      const blob = await response.blob();
      if (!blob.size || !response.headers.get('content-type')?.includes('audio/mpeg')) throw new SpeechServiceError('Invalid MP3', true);
      return { response, blob };
    })(), deadline]);
  } catch (error) {
    if (!signal.aborted && (controller.signal.aborted || error instanceof TypeError)) {
      throw new SpeechServiceError(controller.signal.aborted ? 'TTS request timeout' : 'TTS network unavailable', true);
    }
    throw error;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
