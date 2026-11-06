'use client';
import { primeBrowserSpeech } from './browser-speech';

let audio: HTMLAudioElement | undefined;
/** Reuse the exact element primed by the user gesture, including across chat routes. */
export function getChatAudio() {
  if (!audio) { audio = new Audio(); audio.preload = 'auto'; audio.setAttribute('playsinline', ''); }
  return audio;
}

export function primeChatAudio() {
  primeBrowserSpeech();
  const player = getChatAudio();
  // A short, genuinely silent PCM WAV; no remote request or audible unlock sound.
  const bytes = new Uint8Array(844);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => [...text].forEach((char, i) => bytes[at + i] = char.charCodeAt(0));
  ascii(0, 'RIFF'); view.setUint32(4, 836, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, 800, true);
  player.src = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  player.volume = 1;
  // Must remain synchronous with the send/microphone tap. Safari may still require replay.
  try { void player.play().catch(() => {}); } catch { /* Device speech remains available if media playback is blocked. */ }
}
