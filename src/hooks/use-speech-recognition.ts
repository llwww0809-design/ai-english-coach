'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } }; resultIndex: number };
type RecognitionError = { error: string };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: RecognitionError) => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => Recognition;

export function useSpeechRecognition(onText: (text: string) => void) {
  const recognitionRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => {
    const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setSupported(false); return; }
    const recognition = new Constructor();
    recognition.lang = 'en-US'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = event => { let text = ''; for (let i = event.resultIndex; i < Object.keys(event.results).length; i++) text += event.results[i][0].transcript; if (text.trim()) onTextRef.current(text); };
    recognition.onerror = event => { setListening(false); setError(event.error === 'not-allowed' ? '请允许浏览器使用麦克风后重试。' : '没有听清，请靠近麦克风再说一次。'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => { recognition.abort(); recognitionRef.current = null; };
  }, []);
  const toggle = useCallback(() => {
    if (!supported || !recognitionRef.current) { setError('当前浏览器不支持语音输入，请使用 Safari 或 Chrome。'); return; }
    setError('');
    if (listening) { recognitionRef.current.stop(); setListening(false); } else { try { recognitionRef.current.start(); setListening(true); } catch { setError('语音输入正在启动，请稍后再试。'); } }
  }, [listening, supported]);
  return { supported, listening, error, toggle };
}
