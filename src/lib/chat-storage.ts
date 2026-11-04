import { parseFeedback, type ExpressionFeedback } from './feedback';
export type ChatMessage = { id: number; role: 'assistant' | 'user'; content: string; feedback?: ExpressionFeedback; feedbackState?: 'pending' | 'unavailable' };
const STORAGE_KEY = 'english-coach.teacher-chat.v1';
const storageKey = (scene?: string) => scene ? `english-coach.scenario-chat.${scene}.v1` : STORAGE_KEY;

/** Reject malformed storage without allowing it to break the chat screen. */
export function loadChat(scene?: string): ChatMessage[] | null {
 const raw = localStorage.getItem(storageKey(scene));
 if (!raw) return null;
 const value: unknown = JSON.parse(raw);
 if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid chat history');
 const ids = new Set<number>();
 for (const item of value) {
  if (!item || typeof item !== 'object' || !Number.isSafeInteger(item.id) || item.id < 0 || ids.has(item.id) || !['assistant', 'user'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim()) throw new Error('Invalid chat message');
  ids.add(item.id);
 }
 return value.map(item => ({ id: item.id, role: item.role, content: item.content, ...(item.role === 'user' ? { feedback: parseFeedback(item.feedback), feedbackState: item.feedbackState === 'pending' || item.feedbackState === 'unavailable' ? 'unavailable' as const : undefined } : {}) })) as ChatMessage[];
}
export function saveChat(messages: ChatMessage[], scene?: string): void {
 localStorage.setItem(storageKey(scene), JSON.stringify(messages.filter(message => message.content.trim())));
}
