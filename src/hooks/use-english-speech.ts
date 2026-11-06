'use client';
import { useRef, useState } from 'react';
import { useChatSpeech } from './use-chat-speech';

/** Legacy word pages share the same server-first playback path as conversation. */
export function useEnglishSpeech() {
  const [notice, setNotice] = useState('');
  const ids = useRef(new Map<string, number>());
  const speech = useChatSpeech(setNotice);
  function speak(key: string, text: string) {
    if (!ids.current.has(key)) ids.current.set(key, ids.current.size + 1);
    speech.speak({ id: ids.current.get(key)!, content: text });
  }
  const playing = [...ids.current].find(([, id]) => id === speech.speakingId)?.[0] ?? null;
  return { supported: speech.available, playing, notice, speak, stop: speech.stop };
}
