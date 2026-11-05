import { getUserLevel, normalizeLearningLevel, type UserLevel } from './level-config';
import { parseFeedback, type ExpressionFeedback } from './feedback';
import { resolveSessionTitle } from './chat-title';
export type ChatMessage = { id: number; role: 'assistant' | 'user'; content: string; level?: UserLevel; translation?: string; feedback?: ExpressionFeedback; feedbackState?: 'pending' | 'unavailable' };
export type Message = ChatMessage;
export interface ChatSession {
 id: string;
 title: string;
 titleSource?: 'auto' | 'manual';
 createdAt: number;
 updatedAt: number;
 messages: Message[];
 level: string;
}
const STORAGE_KEY = 'english-coach.teacher-chat.v1';
const SESSIONS_KEY = 'english-coach.teacher-sessions.v1';
const CURRENT_SESSION_KEY = 'english-coach.teacher-current-session.v1';
const storageKey = (scene?: string) => scene ? `english-coach.scenario-chat.${scene}.v1` : STORAGE_KEY;

function canUseStorage() { return typeof window !== 'undefined' && !!window.localStorage; }
function canUseLegacyStorage() { return typeof localStorage !== 'undefined'; }

/** Reject malformed storage without allowing it to break the chat screen. */
export function loadChat(scene?: string): ChatMessage[] | null {
 if (!canUseLegacyStorage()) return null;
 const raw = localStorage.getItem(storageKey(scene));
 if (!raw) return null;
 const value: unknown = JSON.parse(raw);
 if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid chat history');
 const ids = new Set<number>();
 for (const item of value) {
  if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.id) || item.id < 0 || ids.has(item.id) || !['assistant', 'user'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim()) throw new Error('Invalid chat message');
  ids.add(item.id);
 }
 return value.map(item => ({ id: item.id, role: item.role, content: item.content, ...(item.role === 'assistant' && typeof item.translation === 'string' && item.translation.length <= 2000 ? { translation: item.translation } : {}), ...(item.role === 'user' ? { feedback: parseFeedback(item.feedback), feedbackState: item.feedbackState === 'pending' || item.feedbackState === 'unavailable' ? 'unavailable' as const : undefined } : {}) })) as ChatMessage[];
}
export function saveChat(messages: ChatMessage[], scene?: string): void {
 if (!canUseLegacyStorage()) return;
 localStorage.setItem(storageKey(scene), JSON.stringify(messages.filter(message => message.content.trim())));
}

function parseSessions(raw: string | null): ChatSession[] {
 if (!raw) return [];
 try {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChatSession => {
   return !!item && typeof item === 'object' && typeof (item as ChatSession).id === 'string' && typeof (item as ChatSession).title === 'string' && typeof (item as ChatSession).createdAt === 'number' && typeof (item as ChatSession).updatedAt === 'number' && Array.isArray((item as ChatSession).messages) && typeof (item as ChatSession).level === 'string';
  }).map(item => ({ ...item, messages: item.messages.filter(message => message && typeof message.content === 'string').map(message => ({ ...message, level: normalizeLearningLevel(message.level ?? item.level) })) }));
 } catch { return []; }
}

/** Returns teacher conversations, newest first. Existing single-chat data is migrated once. */
export function getSessions(): ChatSession[] {
 if (!canUseStorage()) return [];
 const existing = parseSessions(window.localStorage.getItem(SESSIONS_KEY));
 if (existing.length) return existing.map(session => ({ ...session, title: resolveSessionTitle(session) })).sort((a, b) => b.updatedAt - a.updatedAt);
 const legacy = loadChat();
 if (!legacy?.length) return [];
 const now = Date.now();
 const migrated: ChatSession = { id: `session-${now}`, title: '新对话', createdAt: now, updatedAt: now, messages: legacy, level: getUserLevel() };
 window.localStorage.setItem(SESSIONS_KEY, JSON.stringify([migrated]));
 window.localStorage.removeItem(STORAGE_KEY);
 setCurrentSessionId(migrated.id);
 return [migrated];
}

export function getSession(id: string): ChatSession | null { return getSessions().find(session => session.id === id) ?? null; }
export function saveSession(session: ChatSession): void {
 if (!canUseStorage()) return;
 const sessions = getSessions().filter(item => item.id !== session.id);
 window.localStorage.setItem(SESSIONS_KEY, JSON.stringify([{ ...session, updatedAt: session.updatedAt || Date.now() }, ...sessions]));
 setCurrentSessionId(session.id);
}
export function deleteSession(id: string): void {
 if (!canUseStorage()) return;
 const sessions = getSessions().filter(session => session.id !== id);
 window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
 if (getCurrentSessionId() === id) window.localStorage.removeItem(CURRENT_SESSION_KEY);
}
export function getCurrentSessionId(): string | null { return canUseStorage() ? window.localStorage.getItem(CURRENT_SESSION_KEY) : null; }
export function setCurrentSessionId(id: string): void { if (canUseStorage()) window.localStorage.setItem(CURRENT_SESSION_KEY, id); }
