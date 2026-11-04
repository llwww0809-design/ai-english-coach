'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { getMockTeacherReply } from '@/lib/mock-teacher';
import styles from './teacher.module.css';
import { loadChat, saveChat, type ChatMessage as Message } from '@/lib/chat-storage';
import { addActivity } from '@/lib/activity-storage';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { requestAiReply } from '@/lib/ai-client';
import { useChatSpeech } from '@/hooks/use-chat-speech';
import { ttsVoices } from '@/lib/tts-voices';
import { ExpressionFeedbackCard } from '@/components/expression-feedback';

const greeting: Message = { id: 0, role: 'assistant', content: 'Hi! I’m your English coach. No pressure, just practice. Tell me one good thing about your day! 🌿' };

export default function TeacherPage() {
 const [messages, setMessages] = useState<Message[]>([greeting]);
 const [draft, setDraft] = useState('');
 const [hydrated, setHydrated] = useState(false);
 const [storageWarning, setStorageWarning] = useState('');
 const [isTyping, setIsTyping] = useState(false);
 const [notice, setNotice] = useState('');
 const chatSpeech = useChatSpeech(setNotice);
 const { speakingId, available: speechAvailable, stop: stopSpeech, speak } = chatSpeech;
 const listRef = useRef<HTMLDivElement>(null);
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const sendingRef = useRef(false);
 const requestRef = useRef<AbortController | null>(null);
 const nextId = useRef(1);
 const turnRef = useRef(0);
 const handleSpeechText = useCallback((text: string) => setDraft(text), []);
 const speechInput = useSpeechRecognition(handleSpeechText);
 useEffect(() => { if (speechInput.error) setNotice(speechInput.error); else if (speechInput.listening) setNotice('正在聆听英文…说完后会自动停止'); }, [speechInput.error, speechInput.listening]);
 useEffect(() => {
  try {
   const saved = loadChat();
   if (saved) {
    setMessages(saved);
    nextId.current = Math.max(...saved.map(message => message.id)) + 1;
    turnRef.current = saved.filter(message => message.role === 'assistant').length - 1;
   }
  } catch {
   setStorageWarning('无法读取本地记录，已打开新对话。');
  }
  setHydrated(true);
 }, []);
 useEffect(() => {
  if (!hydrated || isTyping) return;
  try { saveChat(messages); setStorageWarning(''); }
  catch { setStorageWarning('当前浏览器无法保存记录，请勿刷新以免丢失对话。'); }
 }, [messages, hydrated, isTyping]);
 function startNewChat() {
  if (!window.confirm('开始新对话？当前聊天记录将被清空，此操作无法撤销。')) return;
  requestRef.current?.abort(); requestRef.current = null;
  if (timerRef.current) clearTimeout(timerRef.current);
  sendingRef.current = false; nextId.current = 1; turnRef.current = 0;
  stopSpeech();
  setIsTyping(false); setDraft(''); setMessages([greeting]);
  setNotice('已开始新对话。');
 }
 useEffect(() => () => { requestRef.current?.abort(); if (timerRef.current) clearTimeout(timerRef.current); }, []);
 useEffect(() => { const list = listRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);
 async function send(event?: FormEvent) {
  event?.preventDefault();
  const text = draft.trim();
  if (!text || sendingRef.current || !hydrated) return;
  chatSpeech.prepare();
  sendingRef.current = true;
  addActivity({ type: 'teacher', title: '与 AI 老师完成了一次自由对话', detail: text.slice(0, 80), });
  const userId = nextId.current++;
  setMessages(previous => [...previous, { id: userId, role: 'user', content: text, feedbackState: 'pending' }]);
  setDraft(''); setNotice(''); setIsTyping(true);
  const controller = new AbortController(); requestRef.current = controller;
  const assistantId = nextId.current++; let received = '';
  setMessages(previous => [...previous, { id: assistantId, role: 'assistant', content: '' }]);
  try {
   const content = await requestAiReply([...messages, { role: 'user', content: text }].map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })), undefined, delta => { if (controller.signal.aborted) return; received += delta; setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content: received } : message)); }, controller.signal, feedback => { if (controller.signal.aborted) return; setMessages(previous => previous.map(message => message.id === userId ? { ...message, feedback, feedbackState: feedback ? undefined : 'unavailable' } : message)); });
   if (controller.signal.aborted) return;
   setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content } : message));
   chatSpeech.autoSpeak({ id: assistantId, content });
  } catch (error) {
   if (controller.signal.aborted) return;
   if (received) { setNotice('连接中断，已保留收到的回复。可以继续提问。'); return; }
   const content = getMockTeacherReply(text, turnRef.current++);
   setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content } : message));
   setNotice(error instanceof Error && error.message.includes('not configured') ? '当前使用本地演示模式；配置 .env.local 后可启用 AI。' : 'AI 暂时无法连接，已切换本地演示回复。');
  } finally { if (requestRef.current === controller) { requestRef.current = null; setIsTyping(false); sendingRef.current = false; setMessages(previous => previous.map(message => message.id === userId && message.feedbackState === 'pending' ? { ...message, feedbackState: 'unavailable' } : message)); } }
 }
 function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
 }
 return <div className={styles.page}><div className={styles.workspace}>
  <header className={styles.header}><Link href="/" className={styles.back} aria-label="返回首页">←</Link><div className={styles.avatar} aria-hidden="true">✳</div><div className={styles.identity}><h1>AI 英语老师</h1><span><i />在线 · 陪你轻松练习</span></div><div className={styles.headerActions}><span className={styles.demo}>模拟体验</span><button type="button" className={styles.newChat} onClick={startNewChat} disabled={!hydrated} title="清空记录并开始新对话">＋ 新对话</button></div></header>
  <div className={styles.conversation} ref={listRef}>
   <div className={styles.intro}><span>YOUR EVERYDAY ENGLISH COMPANION</span><h2>从一句 Hello 开始。</h2><p>不用完美，愿意表达就是进步。</p><small>本地预设回复 · 免费练习 · 对话保存在当前浏览器</small></div>
   <div className={styles.date}>今天 · 自由对话</div>
   <div role="log" aria-label="对话历史" aria-live="polite" aria-relevant="additions" className={styles.messages}>
   {messages.map(message => <div key={message.id} className={message.role === 'user' ? styles.userRow : styles.aiRow}>{message.role === 'assistant' && <span className={styles.messageAvatar} aria-hidden="true">✳</span>}<div className={styles.messageBody}><span className={message.role === 'user' ? styles.srOnly : styles.sender}>{message.role === 'user' ? '你' : 'English Coach'}</span><div className={styles.bubbleLine}><div className={styles.bubble} lang="en">{message.content || '正在思考…'}{isTyping && message.role === 'assistant' && message.content && message.id === messages[messages.length - 1]?.id ? <span className={styles.streamCursor} aria-hidden="true">▍</span> : null}</div>{message.role === 'assistant' && <button type="button" className={`${styles.speakButton} ${speakingId === message.id ? styles.speaking : ''}`} onClick={() => speak(message)} disabled={!speechAvailable || !message.content || (isTyping && message.id === messages[messages.length - 1]?.id)} aria-label={speakingId === message.id ? '停止朗读' : '朗读这条回复'} title={speakingId === message.id ? '停止朗读' : '朗读'}><span aria-hidden="true">{speakingId === message.id ? '◼' : '🔊'}</span><span className={styles.srOnly}>{speakingId === message.id ? '停止朗读' : '朗读'}</span></button>}</div>{message.role === 'user' && <ExpressionFeedbackCard feedback={message.feedback} state={message.feedbackState} />}</div></div>)}
   {isTyping && !messages[messages.length - 1]?.content && <div className={styles.typing} role="status">✳ 老师正在组织回复<span>•••</span></div>}
   </div>
  </div>
  <div className={styles.composer}><p className={styles.hint}>✧ 每一次开口，都让你离自信更近一点。</p><div className={styles.speechControls}><select className={styles.voiceSelect} aria-label="朗读音色" value={chatSpeech.voice} onChange={event => chatSpeech.selectVoice(event.target.value)}>{ttsVoices.map(voice => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select><button type="button" className={`${styles.autoSpeech} ${chatSpeech.enabled ? styles.autoSpeechOn : ''}`} aria-pressed={chatSpeech.enabled} disabled={!speechAvailable} onClick={chatSpeech.toggle} title="控制新回复生成后的自动朗读">{chatSpeech.enabled ? '🔊' : '🔇'} 自动发音 · {chatSpeech.enabled ? '开' : '关'}</button></div><form onSubmit={send} className={styles.inputBar}>
   <button type="button" className={`${styles.mic} ${speechInput.listening ? styles.micListening : ''}`} aria-label={speechInput.listening ? '停止语音输入' : '开始语音输入'} onClick={() => { chatSpeech.prepare(); speechInput.toggle(); }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button>
   <label className={styles.srOnly} htmlFor="chat-message">输入英文消息</label><textarea id="chat-message" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="用英语聊聊你的一天…" />
   <button type="submit" className={styles.send} disabled={!hydrated || !draft.trim() || isTyping} aria-label="发送消息">↑</button>
  </form><div className={styles.bottomLine}><span>{storageWarning || notice || (!speechAvailable ? '此浏览器不支持朗读 · 仍可文字练习' : '自动保存在此浏览器 · Enter 发送')}</span><span>{draft.length}/2000</span></div><div className={styles.srOnly} role="status">{storageWarning || notice}</div></div>
 </div></div>;
}
