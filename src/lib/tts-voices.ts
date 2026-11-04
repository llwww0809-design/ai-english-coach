export const ttsVoices = [
  { id: 'en-US-JennyNeural', label: 'Jenny · 美音女声' },
  { id: 'en-US-GuyNeural', label: 'Guy · 美音男声' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia · 英音女声' },
] as const;
export const defaultVoice = 'en-US-JennyNeural';
export type TtsVoice = typeof ttsVoices[number]['id'];
export function isTtsVoice(value: unknown): value is TtsVoice {
  return ttsVoices.some(voice => voice.id === value);
}
