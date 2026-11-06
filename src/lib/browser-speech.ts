'use client';

let current: SpeechSynthesisUtterance | null = null;
let revision = 0;
export function stopBrowserSpeech() {
  revision++;
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
export function primeBrowserSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    // Invoke both speech engines in the original tap, before any fetch/await.
    window.speechSynthesis.getVoices();
    const silent = new SpeechSynthesisUtterance(' '); silent.volume = 0;
    window.speechSynthesis.speak(silent);
    window.speechSynthesis.resume();
  } catch { /* Speech support is optional. */ }
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
/** Fetch and body consumption share the same deadline; caller cancellation stays distinct. */
export async function fetchSpeech(text: string, signal: AbortSignal, options: Record<string, unknown> = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 12000);
  try {
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ ...options, text }) });
    if (!response.ok) throw new Error('TTS unavailable');
    const blob = await response.blob();
    if (!blob.size || !response.headers.get('content-type')?.includes('audio/mpeg')) throw new Error('Invalid MP3');
    return { response, blob };
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
