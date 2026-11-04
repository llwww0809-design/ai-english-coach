'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
export function useEnglishSpeech() {
 const [supported,setSupported]=useState(false);
 const [playing,setPlaying]=useState<string | null>(null);
 const [notice,setNotice]=useState('');
 const generation=useRef(0);
 const utterance=useRef<SpeechSynthesisUtterance | null>(null);
 const stop=useCallback(()=>{generation.current++; if(typeof window!=='undefined' && 'speechSynthesis' in window)window.speechSynthesis.cancel();utterance.current=null;setPlaying(null);},[]);
 useEffect(()=>{setSupported('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance==='function');const hide=()=>stop();window.addEventListener('pagehide',hide);return()=>{window.removeEventListener('pagehide',hide);generation.current++;if('speechSynthesis' in window)window.speechSynthesis.cancel();utterance.current=null;};},[stop]);
 function speak(key:string,text:string){
  if(!supported){setNotice('此浏览器不支持语音朗读，可以继续翻卡复习。');return;}
  if(playing===key){stop();setNotice('已停止朗读。');return;}
  stop();const token=generation.current;
  try{const synth=window.speechSynthesis;const item=new SpeechSynthesisUtterance(text);utterance.current=item;const voice=synth.getVoices().find(v=>v.lang==='en-US') || synth.getVoices().find(v=>v.lang==='en-GB');item.lang=voice?.lang || 'en-US';if(voice)item.voice=voice;item.rate=.9;
   item.onend=()=>{if(generation.current!==token)return;setPlaying(null);utterance.current=null;};
   item.onerror=()=>{if(generation.current!==token)return;setPlaying(null);utterance.current=null;setNotice('设备发音暂不可用，请检查英语语音设置后重试。');};
   setPlaying(key);setNotice('');synth.speak(item);
  }catch{setPlaying(null);setNotice('发音暂不可用，可以继续翻卡复习。');}
 }
 return {supported,playing,notice,speak,stop};
}
