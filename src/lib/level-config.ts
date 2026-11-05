export const learningLevels = [
  { id: 'L1', cefr: 'A1', name: '零基础破冰', detail: '500 个基础词 · 短句与二选一', ttsRate: '-20%' },
  { id: 'L2', cefr: 'A2', name: '日常起步', detail: '1500 个常用词 · 轻松短对话', ttsRate: '-10%' },
  { id: 'L3', cefr: 'B1', name: '职场 / 出行进阶', detail: '自然口语 · 高频短语动词', ttsRate: '+0%' },
  { id: 'L4', cefr: 'B2', name: '深度交流', detail: '全英文沉浸 · 流利多样表达', ttsRate: '+5%' },
  { id: 'L5', cefr: 'C1', name: '母语挑战', detail: '俚语隐喻 · 深度话题', ttsRate: '+10%' },
] as const;

export type UserLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type LearningLevel = UserLevel;
export const DEFAULT_LEVEL: LearningLevel = 'L3';
export const LEVEL_STORAGE_KEY = 'ai_english_user_level';
export const LEVEL_KEY = LEVEL_STORAGE_KEY;
const LEGACY_LEVEL_KEY = 'english-coach.level.v1';
export const LEVEL_EVENT = 'app-level-changed';

export function isLearningLevel(value: unknown): value is LearningLevel {
  return learningLevels.some(level => level.id === value);
}

export function normalizeLearningLevel(value: unknown): LearningLevel {
  if (isLearningLevel(value)) return value;
  if (value === 'A1') return 'L1';
  if (value === 'A2') return 'L2';
  if (value === 'B1') return 'L3';
  if (value === 'B2') return 'L4';
  if (value === 'C1') return 'L5';
  return DEFAULT_LEVEL;
}

export function getLevelPrompt(level: LearningLevel) {
  const prompts: Record<LearningLevel, string> = {
    L1: 'Learner level L1 (CEFR A1). Use only the 500 most basic everyday words, very short simple sentences without subordinate clauses. Speak very slowly and clearly. Ask an easy either/or question. Keep the conversation encouraging and understandable.',
    L2: 'Learner level L2 (CEFR A2). Use around 1500 core everyday words and natural short spoken exchanges. Keep wording clear and friendly.',
    L3: 'Learner level L3 (CEFR B1). This is the default. Use natural spoken English with common phrasal verbs and useful everyday expressions.',
    L4: 'Learner level L4 (CEFR B2). Use immersive English, fluent connected speech, and varied natural conversational phrasing.',
    L5: 'Learner level L5 (CEFR C1). Use authentic native pace, idioms, metaphors, advanced vocabulary, complex rhetorical structures, and thoughtful discussion while remaining warm and conversational.',
  };
  return prompts[level];
}

// Pure module: safe to import from route handlers and from client request boundaries.
let memoryLevel: UserLevel = DEFAULT_LEVEL;
let volatileSelection = false;
export function getUserLevel(): UserLevel {
  if (typeof window === 'undefined') return DEFAULT_LEVEL;
  if (volatileSelection) return memoryLevel;
  try {
    const current = window.localStorage.getItem(LEVEL_STORAGE_KEY);
    const stored = current ?? window.localStorage.getItem(LEGACY_LEVEL_KEY);
    memoryLevel = normalizeLearningLevel(stored);
    if (stored && current !== memoryLevel) window.localStorage.setItem(LEVEL_STORAGE_KEY, memoryLevel);
  } catch { /* Private browsing: preserve the current tab's selection. */ }
  return memoryLevel;
}
export function setUserLevel(value: UserLevel): void {
  if (typeof window === 'undefined' || !isLearningLevel(value)) return;
  memoryLevel = value;
  try { window.localStorage.setItem(LEVEL_STORAGE_KEY, value); volatileSelection = false; }
  catch { volatileSelection = true; }
  window.dispatchEvent(new CustomEvent(LEVEL_EVENT, { detail: value }));
}
