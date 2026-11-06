import { isLearningLevel, type UserLevel } from './level-config';
import { listeningSeeds } from './listening-seeds';

export interface SlowArticle {
  id: string;
  titleEn: string;
  titleZh: string;
  category: string;
  level: UserLevel;
  audioSpeed: number;
  duration: string;
  sentences: { id: string; en: string; zh: string }[];
  createdAt: string;
  isCustom?: boolean;
}

export const LISTEN_STORAGE_KEY = 'custom_listen_articles';
export const DELETED_LISTEN_IDS_KEY = 'deleted_listen_article_ids';
export const LISTEN_UPDATED_EVENT = 'app-listen-updated';

export function countListeningWords(sentences: { en: string }[]): number {
  return sentences.reduce((count, sentence) => count + (sentence.en.match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g)?.length || 0), 0);
}

export function estimateDuration(sentences: { en: string }[], speed = 0.8): string {
  const words = countListeningWords(sentences);
  // Estimate only: 85 WPM at 0.8x; actual neural speech varies by sentence.
  const seconds = Math.max(1, Math.round(words / (85 * speed / 0.8) * 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Preserve older short articles; new generation is validated more strictly below. */
export function parseListeningArticle(value: unknown, expectedLevel?: UserLevel): SlowArticle {
  if (!value || typeof value !== 'object') throw new Error('篇章格式无效，请重试。');
  const data = value as Record<string, unknown>;
  if (!isLearningLevel(data.level) || (expectedLevel && data.level !== expectedLevel)) throw new Error('篇章等级不匹配，请重试。');
  const titleEn = cleanText(data.titleEn, 120), titleZh = cleanText(data.titleZh, 100);
  if (!titleEn || !titleZh || !Array.isArray(data.sentences) || data.sentences.length < 6 || data.sentences.length > 14) throw new Error('篇章须包含中英标题及 6–14 句双语内容。');
  const sentences = data.sentences.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('篇章句子格式无效。');
    const en = cleanText(raw.en, 1200), zh = cleanText(raw.zh, 1000);
    if (!/[A-Za-z]/.test(en) || !zh) throw new Error('篇章缺少英文或中文翻译。');
    return { id: `sentence-${index + 1}`, en, zh };
  });
  return {
    id: cleanText(data.id, 100) || `listen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    titleEn, titleZh, category: cleanText(data.category, 24) || '生活', level: data.level,
    audioSpeed: data.audioSpeed === 1 ? 1 : 0.8, duration: estimateDuration(sentences), sentences,
    createdAt: typeof data.createdAt === 'string' && !Number.isNaN(Date.parse(data.createdAt)) ? data.createdAt : new Date().toISOString(),
    isCustom: data.isCustom === true,
  };
}

export function parseGeneratedListeningArticle(value: unknown, level: UserLevel): SlowArticle {
  const article = parseListeningArticle(value, level);
  const words = countListeningWords(article.sentences);
  if (article.sentences.length < 10 || words < 110 || words > 150) throw new Error('新篇章须包含 10–14 句、110–150 个英文词，请重新生成。');
  return { ...article, audioSpeed: 0.8, isCustom: true };
}

export function getCustomListeningArticles(): SlowArticle[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(LISTEN_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    const unique = new Map<string, SlowArticle>();
    for (const item of stored) {
      try {
        const article = { ...parseListeningArticle(item), isCustom: true };
        if (!listeningSeeds.some(seed => seed.id === article.id) && !unique.has(article.id)) unique.set(article.id, article);
      }
      catch { /* A corrupt entry must not hide valid articles. */ }
    }
    return [...unique.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch { return []; }
}

export function getDeletedListeningArticleIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DELETED_LISTEN_IDS_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
  } catch { return []; }
}

export function getListeningArticles(level: UserLevel): SlowArticle[] {
  const custom = getCustomListeningArticles();
  const ids = new Set(custom.map(item => item.id));
  const deleted = new Set(getDeletedListeningArticleIds());
  return [...custom, ...listeningSeeds.filter(item => !ids.has(item.id)).map(item => ({ ...item, duration: estimateDuration(item.sentences), isCustom: false }))]
    .filter(item => !deleted.has(item.id))
    .filter(item => item.level === level)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveListeningArticle(value: SlowArticle): SlowArticle {
  if (typeof window === 'undefined') throw new Error('请在浏览器中保存篇章。');
  const article = { ...parseListeningArticle(value), isCustom: true };
  if (listeningSeeds.some(seed => seed.id === article.id)) throw new Error('不能覆盖系统预置篇章。');
  const articles = getCustomListeningArticles().filter(item => item.id !== article.id);
  try { window.localStorage.setItem(LISTEN_STORAGE_KEY, JSON.stringify([article, ...articles])); }
  catch { throw new Error('本地保存失败，请检查浏览器存储空间或权限。'); }
  window.dispatchEvent(new Event(LISTEN_UPDATED_EVENT));
  return article;
}

export function deleteListeningArticle(id: string): void {
  if (typeof window === 'undefined') throw new Error('请在浏览器中管理篇章。');
  const articles = getCustomListeningArticles().filter(article => article.id !== id);
  const deleted = [...new Set([...getDeletedListeningArticleIds(), id])];
  const previousArticles = window.localStorage.getItem(LISTEN_STORAGE_KEY);
  const previousDeleted = window.localStorage.getItem(DELETED_LISTEN_IDS_KEY);
  try {
    window.localStorage.setItem(LISTEN_STORAGE_KEY, JSON.stringify(articles));
    window.localStorage.setItem(DELETED_LISTEN_IDS_KEY, JSON.stringify(deleted));
  } catch {
    try {
      if (previousArticles === null) window.localStorage.removeItem(LISTEN_STORAGE_KEY);
      else window.localStorage.setItem(LISTEN_STORAGE_KEY, previousArticles);
      if (previousDeleted === null) window.localStorage.removeItem(DELETED_LISTEN_IDS_KEY);
      else window.localStorage.setItem(DELETED_LISTEN_IDS_KEY, previousDeleted);
    } catch { /* best effort rollback when storage is unavailable */ }
    throw new Error('删除保存失败，请检查浏览器存储权限。');
  }
  window.dispatchEvent(new Event(LISTEN_UPDATED_EVENT));
}
