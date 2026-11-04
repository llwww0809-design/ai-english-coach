'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { scenarioReply, type Scenario } from '@/lib/scenarios';
import styles from '@/app/teacher/teacher.module.css';
import { loadChat, saveChat, type ChatMessage as Message } from '@/lib/chat-storage';
import { addActivity } from '@/lib/activity-storage';
import { useSpeechRecognition } from '@/hooks/use-speech-recognition';
import { requestAiReply } from '@/lib/ai-client';
import { useChatSpeech } from '@/hooks/use-chat-speech';
import { ExpressionFeedbackCard } from '@/components/expression-feedback';

export default function ScenarioChat({scene}: {scene: Scenario}) {
 const initialMessages: Message[] = scene.demo.map((message,id)=>({...message,id}));
 const [messages, setMessages] = useState<Message[]>(initialMessages);
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
 const nextId = useRef(scene.demo.length);
 const turnRef = useRef(0);
 const completedRef = useRef(false);
 useEffect(() => {
  try {
   const saved = loadChat(scene.slug);
   if (saved) {
    setMessages(saved);
    nextId.current = Math.max(...saved.map(message => message.id)) + 1;
    turnRef.current = saved.filter(message => message.role === 'assistant' && message.id >= scene.demo.length).length;
    completedRef.current = saved.filter(message => message.role === 'user').length >= 3;
   }
  } catch { setStorageWarning('无法读取场景记录，已打开示范对话。'); }
  setHydrated(true);
 }, [scene.slug, scene.demo.length]);
 useEffect(() => {
  if (!hydrated || isTyping) return;
  try { saveChat(messages, scene.slug); setStorageWarning(''); }
  catch { setStorageWarning('此浏览器暂时无法保存场景记录，请检查存储权限。'); }
 }, [messages, hydrated, isTyping, scene.slug]);
 const handleSpeechText = useCallback((text: string) => setDraft(text), []);
 const speechInput = useSpeechRecognition(handleSpeechText);
 useEffect(() => { if (speechInput.error) setNotice(speechInput.error); else if (speechInput.listening) setNotice('正在聆听英文…说完后会自动停止'); }, [speechInput.error, speechInput.listening]);
 function startNewChat() {
  if (!hydrated) return;
  if (!window.confirm('重新开始本场景？当前练习将重置为示范对话。')) return;
  requestRef.current?.abort(); requestRef.current = null;
  if (timerRef.current) clearTimeout(timerRef.current);
  sendingRef.current = false; nextId.current = scene.demo.length; turnRef.current = 0;
  completedRef.current = false;
  stopSpeech();
  setIsTyping(false); setDraft(''); setMessages(initialMessages);
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
  const userTurns = messages.filter(message => message.role === 'user').length + 1;
  if (userTurns >= 3 && !completedRef.current) { completedRef.current = true; addActivity({ type: 'scenario', title: `完成了${scene.name}情景对话`, detail: `AI 扮演${scene.aiRole} · 你扮演${scene.userRole}` }); }
  const userId = nextId.current++;
  setMessages(previous => [...previous, { id: userId, role: 'user', content: text, feedbackState: 'pending' }]);
  setDraft(''); setNotice(''); setIsTyping(true);
  const controller = new AbortController(); requestRef.current = controller;
  const assistantId = nextId.current++; let received = '';
  setMessages(previous => [...previous, { id: assistantId, role: 'assistant', content: '' }]);
  try {
   const content = await requestAiReply([...messages, { role: 'user', content: text }].map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })), `You are role-playing as ${scene.aiRole} in ${scene.name}. The learner is ${scene.userRole}. Stay in character, use concise natural English, and gently correct one important mistake when useful. Ask a short follow-up question.`, delta => { if (controller.signal.aborted) return; received += delta; setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content: received } : message)); }, controller.signal, feedback => { if (controller.signal.aborted) return; setMessages(previous => previous.map(message => message.id === userId ? { ...message, feedback, feedbackState: feedback ? undefined : 'unavailable' } : message)); });
   if (controller.signal.aborted) return;
   setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content } : message));
   chatSpeech.autoSpeak({ id: assistantId, content });
  } catch { if (controller.signal.aborted) return; if (received) { setNotice('连接中断，已保留收到的回复。可以继续提问。'); return; } const content = scenarioReply(scene, turnRef.current++); setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content } : message)); setNotice('AI 暂时不可用，已切换本地演示回复；请检查配置或服务端日志。'); }
  finally { if (requestRef.current === controller) { requestRef.current = null; setIsTyping(false); sendingRef.current = false; setMessages(previous => previous.map(message => message.id === userId && message.feedbackState === 'pending' ? { ...message, feedbackState: 'unavailable' } : message)); } }
 }
 function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
 }
 return <div className={styles.page}><div className={styles.workspace}>
  <header className={styles.header}><Link href="/scenarios" className={styles.back} aria-label="返回场景列表">←</Link><div className={styles.avatar} aria-hidden="true">{scene.icon}</div><div className={styles.identity}><h1>{scene.name}</h1><span>AI：{scene.aiRole} · 你：{scene.userRole}</span></div><div className={styles.headerActions}><span className={styles.demo}>模拟体验</span><button type="button" className={styles.newChat} onClick={startNewChat}  title="重置本场景练习">↻ 重练</button></div></header>
  {storageWarning && <p role="alert" className={styles.storageWarning}>{storageWarning}</p>}
  <div className={styles.conversation} ref={listRef}>
   <div className={styles.intro}><span>ROLE PLAY · REAL LIFE ENGLISH</span><h2>{scene.name}</h2><p>{scene.goal}</p><small>下方为一组示范 · 接着最后一句继续练习</small></div>
   <div className={styles.date}>示范 + 角色扮演 · 预设台词按顺序回复</div>
   <div role="log" aria-label="对话历史" aria-live="polite" aria-relevant="additions" className={styles.messages}>
   {messages.map(message => <div key={message.id} className={message.role === 'user' ? styles.userRow : styles.aiRow}>{message.role === 'assistant' && <span className={styles.messageAvatar} aria-hidden="true">✳</span>}<div className={styles.messageBody}><span className={message.role === 'user' ? styles.srOnly : styles.sender}>{message.role === 'user' ? '你' : scene.aiRole}</span><div className={styles.bubbleLine}><div className={styles.bubble} lang="en">{message.content || '正在思考…'}{isTyping && message.role === 'assistant' && message.content && message.id === messages[messages.length - 1]?.id ? <span className={styles.streamCursor} aria-hidden="true">▍</span> : null}</div>{message.role === 'assistant' && <button type="button" className={`${styles.speakButton} ${speakingId === message.id ? styles.speaking : ''}`} onClick={() => speak(message)} disabled={!speechAvailable || !message.content || (isTyping && message.id === messages[messages.length - 1]?.id)} aria-label={speakingId === message.id ? '停止朗读' : '朗读这条回复'} title={speakingId === message.id ? '停止朗读' : '朗读'}><span aria-hidden="true">{speakingId === message.id ? '◼' : '🔊'}</span><span className={styles.srOnly}>{speakingId === message.id ? '停止朗读' : '朗读'}</span></button>}</div>{message.role === 'user' && <ExpressionFeedbackCard feedback={message.feedback} state={message.feedbackState} />}</div></div>)}
   {isTyping && !messages[messages.length - 1]?.content && <div className={styles.typing} role="status">✳ 老师正在组织回复<span>•••</span></div>}
   </div>
  </div>
  <div className={styles.composer}><p className={styles.hint}>✧ 每一次开口，都让你离自信更近一点。</p><div className={styles.speechControls}><button type="button" className={`${styles.autoSpeech} ${chatSpeech.enabled ? styles.autoSpeechOn : ''}`} aria-pressed={chatSpeech.enabled} disabled={!speechAvailable} onClick={chatSpeech.toggle} title="控制新回复生成后的自动朗读">{chatSpeech.enabled ? '🔊' : '🔇'} 自动发音 · {chatSpeech.enabled ? '开' : '关'}</button></div><form onSubmit={send} className={styles.inputBar}>
   <button type="button" className={`${styles.mic} ${speechInput.listening ? styles.micListening : ''}`} aria-label={speechInput.listening ? '停止语音输入' : '开始语音输入'} onClick={() => { if (speechInput.listening) chatSpeech.prepare(); else stopSpeech(); speechInput.toggle(); }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button>
   <label className={styles.srOnly} htmlFor="chat-message">输入英文消息</label><textarea id="chat-message" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="用英语回应，继续这个场景…" />
   <button type="submit" className={styles.send} disabled={!hydrated || !draft.trim() || isTyping} aria-label="发送消息">↑</button>
  </form><div className={styles.bottomLine}><span>{notice || (!speechAvailable ? '此浏览器不支持朗读 · 仍可文字练习' : '本地模拟 · 刷新重置 · Enter 发送')}</span><span>{draft.length}/2000</span></div><div className={styles.srOnly} role="status">{notice}</div></div>
 </div></div>;
}
