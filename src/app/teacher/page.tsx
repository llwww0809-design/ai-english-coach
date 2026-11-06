'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { getMockTeacherReply } from '@/lib/mock-teacher';
import styles from './teacher.module.css';
import { getCurrentSessionId, getSessions, saveSession, deleteSession, setCurrentSessionId, type ChatSession, type ChatMessage as Message } from '@/lib/chat-storage';
import { addActivity } from '@/lib/activity-storage';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useChatViewport } from '@/hooks/use-chat-viewport';
import { requestAiReply } from '@/lib/ai-client';
import { useChatSpeech } from '@/hooks/use-chat-speech';
import { ExpressionFeedbackCard } from '@/components/expression-feedback';
import { useLearningLevel } from '@/hooks/use-learning-level';
import { DEFAULT_LEVEL, getUserLevel, type UserLevel } from '@/lib/level-config';
import { resolveSessionTitle } from '@/lib/chat-title';
import { addVocab, getVocabList, getWordReference, getBankList, VOCAB_UPDATED_EVENT, type VocabItem } from '@/lib/vocab-storage';

const greeting: Message = { id: 0, role: 'assistant', content: "Hi! I'm Jenny, your speaking coach. No pressure, just practice. Tell me one good thing about your day! 🌿" };
function sentenceForWord(content: string, word: string) {
 const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 return content.match(/[^.!?]+[.!?]?/g)?.find(sentence => new RegExp(`\\b${escaped}\\b`, 'i').test(sentence))?.trim() || content.trim();
}

export default function TeacherPage() {
 const [messages, setMessages] = useState<Message[]>([greeting]);
 const [draft, setDraft] = useState('');
 const [voiceMode, setVoiceMode] = useState(false);
 const viewportRef = useChatViewport();
 const [practiceWords, setPracticeWords] = useState<VocabItem[]>([]);
 const inputRef = useRef<HTMLTextAreaElement>(null);
 useEffect(() => {
  const input = inputRef.current;
  if (input) { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 112) + 'px'; }
 }, [draft, voiceMode]);
 useEffect(() => {
  const refresh = () => setPracticeWords(getBankList().filter(word => word.level === getUserLevel()).sort((a, b) => b.addedAt - a.addedAt).slice(0, 3));
  refresh();
  window.addEventListener(VOCAB_UPDATED_EVENT, refresh); window.addEventListener('storage', refresh); window.addEventListener('app-level-changed', refresh); window.addEventListener('focus', refresh);
  const poll = window.setInterval(refresh, 30000);
  return () => { window.clearInterval(poll); window.removeEventListener(VOCAB_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); window.removeEventListener('app-level-changed', refresh); window.removeEventListener('focus', refresh); };
 }, []);
 const [hydrated, setHydrated] = useState(false);
 const [storageWarning, setStorageWarning] = useState('');
 const [isTyping, setIsTyping] = useState(false);
 const [notice, setNotice] = useState('');
 const [expandedTranslations, setExpandedTranslations] = useState<Set<number>>(() => new Set());
 const [sessionId, setSessionId] = useState<string | null>(null);
 const [sessions, setSessions] = useState<ChatSession[]>([]);
 const [historyOpen, setHistoryOpen] = useState(false);
 const [savedSuggestions, setSavedSuggestions] = useState<Set<number>>(() => new Set());
 const [vocabToast, setVocabToast] = useState(false);
 const [selectedWord, setSelectedWord] = useState<string | null>(null);
 const [selectedWordContext, setSelectedWordContext] = useState('');
 const [selectedWordLevel, setSelectedWordLevel] = useState<UserLevel>(DEFAULT_LEVEL);
 const [wordPopoverPosition, setWordPopoverPosition] = useState({ x: 0, y: 0 });
 const { level } = useLearningLevel();
 const chatSpeech = useChatSpeech(setNotice);
 const { speakingId, available: speechAvailable, stop: stopSpeech, speak } = chatSpeech;
 const listRef = useRef<HTMLDivElement>(null);
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const vocabToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const sendingRef = useRef(false);
 const requestRef = useRef<AbortController | null>(null);
 const nextId = useRef(1);
 const turnRef = useRef(0);
 const speechInput = useVoiceRecorder(text => { setDraft(text); void send(undefined, text); }, chatSpeech.prepare);
 useEffect(() => {
  try {
   const stored = getSessions();
   const current = getCurrentSessionId();
   const active = (current && stored.find(session => session.id === current)) || stored[0];
   if (active) {
    setSessionId(active.id); setMessages(active.messages); setCurrentSessionId(active.id);
    nextId.current = Math.max(...active.messages.map(message => message.id), 0) + 1;
    turnRef.current = active.messages.filter(message => message.role === 'assistant').length - 1;
   } else {
    const now = Date.now(); const id = `session-${now}`;
    setSessionId(id); setCurrentSessionId(id);
    saveSession({ id, title: '新对话', createdAt: now, updatedAt: now, messages: [greeting], level: getUserLevel() });
   }
   setSessions(getSessions());
  } catch {
   setStorageWarning('无法读取本地记录，已打开新对话。');
  }
  setHydrated(true);
 }, []);
 useEffect(() => {
  if (!hydrated || isTyping) return;
  try {
   if (!sessionId) return;
   const existing = getSessions().find(session => session.id === sessionId);
   const title = resolveSessionTitle({ title: existing?.title ?? '新对话', titleSource: existing?.titleSource, messages });
   const now = Date.now();
   saveSession({ id: sessionId, title, titleSource: existing?.titleSource ?? 'auto', createdAt: existing?.createdAt ?? now, updatedAt: now, messages, level: existing?.level ?? getUserLevel() });
   setSessions(getSessions()); setStorageWarning('');
  }
  catch { setStorageWarning('当前浏览器无法保存记录，请勿刷新以免丢失对话。'); }
 }, [messages, hydrated, isTyping, sessionId, level]);
 function renameSession(session: ChatSession) {
  const value = window.prompt('为这段对话起一个名字（最多 30 个字）', session.title);
  if (value === null) return;
  const title = value.trim();
  if (!title || [...title].length > 30) { setNotice('标题请输入 1–30 个字。'); return; }
  try {
   // Saving a different session must not change the active conversation.
   const currentId = getCurrentSessionId();
   saveSession({ ...session, title, titleSource: 'manual' });
   if (currentId) setCurrentSessionId(currentId);
   setSessions(getSessions()); setNotice('对话已重命名。');
  } catch { setStorageWarning('重命名未能保存，请检查浏览器本地存储。'); }
 }
 function openSession(session: ChatSession) {
  speechInput.cancel();
  requestRef.current?.abort(); stopSpeech(); setSessionId(session.id); setCurrentSessionId(session.id); setMessages(session.messages); setDraft(''); setIsTyping(false); setExpandedTranslations(new Set()); setSavedSuggestions(new Set()); nextId.current = Math.max(...session.messages.map(message => message.id), 0) + 1; turnRef.current = session.messages.filter(message => message.role === 'assistant').length - 1; setHistoryOpen(false); setNotice(`已载入「${session.title}」`);
 }
 function removeSession(session: ChatSession) {
  if (!window.confirm(`删除「${session.title}」？此操作无法撤销。`)) return;
  deleteSession(session.id); const next = getSessions(); setSessions(next);
  if (session.id === sessionId) {
   if (next[0]) openSession(next[0]); else startNewChat(true);
  }
 }
 function startNewChat(skipConfirm = false) {
  if (!skipConfirm && !window.confirm('开始新对话？当前聊天记录会保留在历史记录中。')) return;
  speechInput.cancel();
  requestRef.current?.abort(); requestRef.current = null;
  if (timerRef.current) clearTimeout(timerRef.current);
  sendingRef.current = false; nextId.current = 1; turnRef.current = 0;
  stopSpeech();
  const now = Date.now(); const id = `session-${now}`;
  setSessionId(id); setCurrentSessionId(id); setIsTyping(false); setDraft(''); setMessages([greeting]); setSavedSuggestions(new Set());
  setSessions(current => [{ id, title: '新对话', createdAt: now, updatedAt: now, messages: [greeting], level }, ...current]);
  setHistoryOpen(false);
  setNotice('已开始新对话。');
 }
 useEffect(() => () => { requestRef.current?.abort(); if (timerRef.current) clearTimeout(timerRef.current); }, []);
 useEffect(() => { const list = listRef.current; if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' }); }, [messages, isTyping]);
 useEffect(() => {
  const viewport = window.visualViewport;
  const keepLatestVisible = () => {
   const list = listRef.current;
   if (list && document.activeElement?.tagName === 'TEXTAREA') list.scrollTo({ top: list.scrollHeight, behavior: 'auto' });
  };
  viewport?.addEventListener('resize', keepLatestVisible);
  return () => viewport?.removeEventListener('resize', keepLatestVisible);
 }, []);
 async function send(event?: FormEvent, recognizedText?: string) {
  event?.preventDefault();
  const text = (recognizedText ?? draft).trim();
  if (!text || sendingRef.current || !hydrated) return;
  chatSpeech.prepare();
  sendingRef.current = true;
  addActivity({ type: 'teacher', title: '与 AI 老师完成了一次自由对话', detail: text.slice(0, 80), });
  const turnLevel = getUserLevel();
  const userId = nextId.current++;
  setMessages(previous => [...previous, { id: userId, role: 'user', level: turnLevel, content: text, feedbackState: 'pending' }]);
  setDraft(''); setNotice(''); setIsTyping(true);
  const controller = new AbortController(); requestRef.current = controller;
  const assistantId = nextId.current++; let received = '';
  setMessages(previous => [...previous, { id: assistantId, role: 'assistant', level: turnLevel, content: '' }]);
  try {
   const content = await requestAiReply([...messages, { role: 'user', content: text }].map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content })), undefined, delta => { if (controller.signal.aborted) return; received += delta; setMessages(previous => previous.map(message => message.id === assistantId ? { ...message, content: received } : message)); }, controller.signal, feedback => { if (controller.signal.aborted) return; setMessages(previous => previous.map(message => message.id === userId ? { ...message, feedback, feedbackState: feedback ? undefined : 'unavailable' as const } : message).map(message => message.id === assistantId && feedback?.translation ? { ...message, translation: feedback.translation } : message)); }, turnLevel, getBankList().filter(word => word.level === turnLevel).sort((a, b) => b.addedAt - a.addedAt).slice(0, 3).map(word => word.word));
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
 function saveSuggestion(message: Message, contextReply?: Message) {
  const suggestion = message.feedback?.suggestion?.trim();
  if (!suggestion || savedSuggestions.has(message.id)) return;
  const sourceLevel = message.level ?? getUserLevel();
  const exists = getVocabList().some(item => item.level === sourceLevel && item.word.toLocaleLowerCase() === suggestion.toLocaleLowerCase());
  if (!exists) addVocab({ word: suggestion, phonetic: '', translation: message.feedback?.explanation || '地道口语表达，结合语境理解', exampleEn: contextReply?.content || suggestion, exampleZh: contextReply?.translation || '结合上下文理解这句话。', level: sourceLevel, source: 'chat_pick' });
  setSavedSuggestions(current => new Set(current).add(message.id));
  setVocabToast(true);
  if (vocabToastTimer.current) clearTimeout(vocabToastTimer.current);
  vocabToastTimer.current = setTimeout(() => setVocabToast(false), 1500);
 }
 function renderAssistantText(message: Message) {
  if (!message.content) return '正在思考…';
  return message.content.split(/([A-Za-z][A-Za-z'-]*)/g).map((part, index) => /^[A-Za-z]/.test(part) ? <button type="button" className={styles.wordToken} key={`${message.id}-${index}`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setSelectedWord(part.toLowerCase()); setSelectedWordLevel(message.level ?? getUserLevel()); setSelectedWordContext(sentenceForWord(message.content, part)); setWordPopoverPosition({ x: Math.min(Math.max(rect.left + rect.width / 2, 155), window.innerWidth - 155), y: Math.max(rect.top - 8, 80) }); }}>{part}</button> : <span key={`${message.id}-${index}`}>{part}</span>);
 }
 function saveChatWord() {
  if (!selectedWord) return;
  const exists = getVocabList().some(item => item.level === selectedWordLevel && item.word.toLocaleLowerCase() === selectedWord.toLocaleLowerCase());
  const reference = getWordReference(selectedWord, selectedWordLevel);
  if (!exists) addVocab({ word: selectedWord, phonetic: reference.phonetic, translation: reference.translation, collocations: reference.collocations, level: selectedWordLevel, source: 'chat_pick', exampleEn: reference.exampleEn || selectedWordContext || selectedWord, exampleZh: reference.exampleZh || '原对话语境例句，未自动改写难度。' });
  setSelectedWord(null); setVocabToast(true);
  if (vocabToastTimer.current) clearTimeout(vocabToastTimer.current);
  vocabToastTimer.current = setTimeout(() => setVocabToast(false), 1500);
 }
 function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
 }
 return <div className={styles.page} ref={viewportRef}>{vocabToast && <div className={styles.vocabToast} role="status">已加入口语词库</div>}<div className={styles.workspace}>
  <header className={styles.header}><button type="button" className={styles.historyButton} onClick={() => setHistoryOpen(true)} aria-label="打开历史记录" title="历史记录">☰</button><div className={styles.identity}><h1>Jenny</h1><span>• 在线 · 你的美式口语搭子</span></div><div className={styles.headerActions}><button type="button" className={styles.newChat} onClick={() => startNewChat()} disabled={!hydrated} title="保留当前对话并开始新对话">＋ 新对话</button></div></header>
  <div className={`${styles.drawerBackdrop} ${historyOpen ? styles.drawerBackdropOpen : ''}`} onClick={() => setHistoryOpen(false)} aria-hidden={!historyOpen} />
  <aside className={`${styles.historyDrawer} ${historyOpen ? styles.historyDrawerOpen : ''}`} aria-label="历史对话" aria-hidden={!historyOpen}>
   <div className={styles.drawerHeader}><div><span>YOUR CONVERSATIONS</span><h2>历史记录</h2></div><button type="button" className={styles.drawerClose} onClick={() => setHistoryOpen(false)} aria-label="关闭历史记录">×</button></div>
   <button type="button" className={styles.drawerNew} onClick={() => startNewChat()}>＋ 新对话</button>
   <div className={styles.sessionList}>{sessions.map(session => <article key={session.id} className={`${styles.sessionCard} ${session.id === sessionId ? styles.sessionActive : ''}`}>
    <button type="button" className={styles.sessionOpen} onClick={() => openSession(session)}><strong>{session.title}</strong><span>{session.messages.filter(message => message.role === 'user').length} 条消息 · {new Date(session.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span></button>
    <button type="button" className={styles.sessionRename} onClick={() => renameSession(session)} disabled={isTyping} aria-label={`重命名${session.title}`} title="重命名对话">✎</button>
    <button type="button" className={styles.sessionDelete} onClick={() => removeSession(session)} aria-label={`删除${session.title}`} title="删除对话">×</button>
   </article>)}{sessions.length === 0 && <p className={styles.emptySessions}>还没有历史对话</p>}</div>
  </aside>
  <div className={styles.conversation} ref={listRef}>
   <div className={styles.date}>今天 · 自由对话</div>
   <div role="log" aria-label="对话历史" aria-live="polite" aria-relevant="additions" className={styles.messages}>
   {messages.map((message, index) => <div key={message.id} className={message.role === 'user' ? styles.userRow : styles.aiRow}><div className={styles.messageBody}><span className={message.role === 'user' ? styles.srOnly : styles.sender}>{message.role === 'user' ? '你' : 'Jenny'}</span><div className={styles.bubbleLine}><div className={styles.bubble} lang="en"><span className={styles.bubbleText}>{message.role === 'assistant' ? renderAssistantText(message) : (message.content || '正在思考…')}{isTyping && message.role === 'assistant' && message.content && message.id === messages[messages.length - 1]?.id ? <span className={styles.streamCursor} aria-hidden="true">▍</span> : null}{message.role === 'assistant' && <span className={styles.inlineActions}>{message.translation && <button type="button" className={`${styles.translateButton} ${expandedTranslations.has(message.id) ? styles.translateActive : ''}`} aria-expanded={expandedTranslations.has(message.id)} onClick={() => setExpandedTranslations(current => { const next = new Set(current); next.has(message.id) ? next.delete(message.id) : next.add(message.id); return next; })} aria-label={expandedTranslations.has(message.id) ? '收起中文翻译' : '展开中文翻译'}>译</button>}<button type="button" className={`${styles.speakButton} ${speakingId === message.id ? styles.speaking : ''}`} onClick={() => speak(message)} disabled={!speechAvailable || !message.content || (isTyping && message.id === messages[messages.length - 1]?.id)} aria-label={speakingId === message.id ? '停止朗读' : '朗读这条回复'} title={speakingId === message.id ? '停止朗读' : '朗读'}><span aria-hidden="true">{speakingId === message.id ? '◼' : '🔊'}</span><span className={styles.srOnly}>{speakingId === message.id ? '停止朗读' : '朗读'}</span></button></span>}</span>{message.role === 'assistant' && message.translation && <div className={`${styles.translation} ${expandedTranslations.has(message.id) ? styles.translationOpen : ''}`} aria-hidden={!expandedTranslations.has(message.id)}><p lang="zh-CN">{message.translation}</p></div>}</div>{message.role === 'user' && <ExpressionFeedbackCard feedback={message.feedback} state={message.feedbackState} saved={savedSuggestions.has(message.id)} onSave={message.feedback?.suggestion ? () => saveSuggestion(message, messages[index + 1]?.role === 'assistant' ? messages[index + 1] : undefined) : undefined} />}</div></div></div>)}
   {isTyping && !messages[messages.length - 1]?.content && <div className={styles.typing} role="status">✳ 老师正在组织回复<span>•••</span></div>}
   </div>
  </div>
  <div className={styles.composer}>{practiceWords.length > 0 && <button type="button" className={styles.practiceTip} onClick={() => { setDraft(current => `${current.trimEnd()}${current.trim() ? ' ' : ''}${practiceWords[0].word} `); inputRef.current?.focus(); }} aria-label={`练习生词 ${practiceWords[0].word}，点击插入输入框`}>💡 试着在对话中用用这个词：<b>{practiceWords[0].word}</b><span>[{practiceWords[0].translation}]</span></button>}<form onSubmit={send} className={styles.inputBar}>
   <button type="button" className={styles.mic} aria-label={voiceMode ? '切换文字键盘' : '切换按住说话'} aria-pressed={voiceMode} disabled={speechInput.phase === 'transcribing'} onClick={() => { speechInput.cancel(); setVoiceMode(value => !value); if (!voiceMode) inputRef.current?.blur(); else requestAnimationFrame(() => inputRef.current?.focus()); }}>{voiceMode ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M5 9h2m3 0h2m3 0h3M5 12h2m3 0h2m3 0h3M7 16h10"/></svg> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>}</button>
   {voiceMode ? <button type="button" className={`${styles.holdToTalk} ${speechInput.phase === 'recording' ? styles.holdActive : ''}`} disabled={!hydrated || isTyping || speechInput.phase === 'transcribing'} aria-label="按住说话，松开发送，上滑取消。键盘可按住空格录音" aria-busy={speechInput.phase === 'transcribing'} onContextMenu={event => event.preventDefault()} onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); void speechInput.start(event.clientY); }} onPointerMove={event => speechInput.move(event.clientY)} onPointerUp={() => speechInput.finish()} onPointerCancel={() => speechInput.finish(true)} onLostPointerCapture={() => speechInput.finish(true)} onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); void speechInput.start(0); } if (event.key === 'Escape') speechInput.finish(true); }} onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); speechInput.finish(); } }}>{speechInput.phase === 'transcribing' ? '正在识别…' : speechInput.phase === 'requesting' ? '正在开启麦克风…' : speechInput.phase === 'recording' ? '松开 发送' : '按住 说话'}</button> : <><label className={styles.srOnly} htmlFor="chat-message">输入英文消息</label><textarea ref={inputRef} id="chat-message" rows={1} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="用英语聊聊你的一天..." /></>}
   <button type="submit" className={styles.send} disabled={!hydrated || !draft.trim() || isTyping || speechInput.phase !== 'idle'} onPointerDown={event => event.preventDefault()} aria-label="发送消息">↑</button>
  </form>{speechInput.error && <p className={styles.recordError} role="alert">{speechInput.error}</p>}<div className={styles.srOnly} role="status">{storageWarning || notice}</div></div>
  </div>{(speechInput.phase === 'recording' || speechInput.phase === 'requesting') && <div className={styles.recordOverlay} role="status" aria-live="polite"><div className={`${styles.recordCard} ${speechInput.cancelling ? styles.recordCancel : ''}`}>{speechInput.cancelling ? <span className={styles.recordSymbol} aria-hidden="true">×</span> : <div className={styles.recordWaves} aria-hidden="true">{[0,1,2,3,4].map(i => <i key={i} style={{ animationDelay: i * 0.12 + 's' }} />)}</div>}<strong>{speechInput.phase === 'requesting' ? '请允许使用麦克风' : speechInput.cancelling ? '松开手指，取消发送' : '松开发送，上滑取消'}</strong></div></div>}{selectedWord && <div className={styles.wordPopover} role="dialog" style={{ left: wordPopoverPosition.x, top: wordPopoverPosition.y, bottom: 'auto' }}><div className={styles.popoverWord}><strong>{selectedWord}</strong><small>{getWordReference(selectedWord, level).phonetic || '音标待补充'}</small><span>{getWordReference(selectedWord, level).translation}</span></div><button type="button" onClick={() => void chatSpeech.speak({ id: -1, content: selectedWord })} aria-label={`朗读 ${selectedWord}`}>🔊</button><button type="button" onClick={saveChatWord}>＋ 收入词库</button><button type="button" onClick={() => setSelectedWord(null)} aria-label="关闭">×</button></div>}</div>;
}
