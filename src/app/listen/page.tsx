'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLearningLevel } from '@/hooks/use-learning-level';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { ArticlePlayer } from '@/components/article-player';
import { getUserLevel } from '@/lib/level-config';
import { deleteListeningArticle, getListeningArticles, LISTEN_UPDATED_EVENT, parseGeneratedListeningArticle, saveListeningArticle, type SlowArticle } from '@/lib/listening-storage';
import styles from './listen.module.css';

export default function ListenPage() {
  const { level, ready } = useLearningLevel();
  const [articles, setArticles] = useState<SlowArticle[]>([]);
  const [selected, setSelected] = useState<SlowArticle | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<AbortController | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const refresh = useCallback(() => { if (ready) setArticles(getListeningArticles(level)); }, [ready, level]);
  const closePlayer = useCallback(() => setSelected(null), []);
  const closeGenerate = useCallback(() => { request.current?.abort(); request.current = null; setGenerating(false); setGenerateOpen(false); setError(''); }, []);
  useModalFocus(sheet, generateOpen, closeGenerate);
  useEffect(() => {
    refresh(); window.addEventListener(LISTEN_UPDATED_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(LISTEN_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [refresh]);
  useEffect(() => { setSelected(null); closeGenerate(); setNotice(''); }, [level, closeGenerate]);
  useEffect(() => () => request.current?.abort(), []);

  async function generate(random = false) {
    if (request.current) return;
    const currentLevel = getUserLevel();
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 65000);
    setGenerating(true); setError('');
    try {
      const response = await fetch('/api/listen', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: random ? '' : topic.trim(), level: currentLevel }) });
      const data = await response.json();
      if (request.current !== controller || getUserLevel() !== currentLevel) return;
      if (controller.signal.aborted) throw new Error('生成超时，请重试。');
      if (!response.ok) throw new Error(data.error || '暂时无法生成篇章。');
      const article = parseGeneratedListeningArticle(data.article, currentLevel);
      saveListeningArticle(article);
      setArticles(getListeningArticles(currentLevel)); setGenerateOpen(false); setTopic(''); setNotice('新篇章已保存，点击卡片开始听读。');
    } catch (cause) {
      if (request.current === controller) setError(controller.signal.aborted ? '生成超时，请重试。' : cause instanceof Error ? cause.message : '生成失败，请稍后重试。');
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setGenerating(false); } }
  }

  function deleteArticle(article: SlowArticle) {
    if (!window.confirm('确定删除这篇听读文章吗？')) return;
    try {
      deleteListeningArticle(article.id);
      if (selected?.id === article.id) setSelected(null);
      refresh();
      setNotice('篇章已删除');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : '删除失败，请稍后重试。');
    }
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span>SLOW ENGLISH</span><h1>慢速听读</h1></div><div className={styles.headerActions}><span className={styles.level}>{level}</span><button type="button" className={styles.generate} disabled={!ready} onClick={() => { setGenerateOpen(true); setError(''); }}>✨ 生成新篇章</button></div></header>
    {!ready ? <p className={styles.empty}>正在加载篇章…</p> : <section className={styles.grid} aria-label={`${level} 听读篇章`}>{articles.filter(article => article.level === level).map(article => <article key={article.id} className={`${styles.card} ${article.isCustom ? styles.cardCustom : ''}`}>
      <button type="button" className={styles.cardOpen} onClick={() => { setSelected(article); setNotice(''); }} aria-label={`听读 ${article.titleEn}`}>
        <div className={styles.meta}><span>{article.category}</span></div><h2 lang="en">{article.titleEn}</h2><p>{article.titleZh}</p><footer><span>{article.level} · Jenny 美音<br /><span>约 {article.duration}</span></span><i aria-hidden="true">▶</i></footer>
      </button>
      <button type="button" className={styles.delete} onClick={() => deleteArticle(article)} aria-label={`删除 ${article.titleEn}`} title="删除篇章"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></svg></button>
    </article>)}</section>}
    {ready && !articles.filter(article => article.level === level).length && <p className={styles.empty}>为当前等级生成一篇新故事吧。</p>}
    <p className={styles.notice} role="status">{notice}</p>
    {selected && selected.level === level && <ArticlePlayer key={selected.id} article={selected} onClose={closePlayer} />}
    {generateOpen && <div className={styles.backdrop} onClick={closeGenerate}><section ref={sheet} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="listen-generate-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header><div><span>{level} · 新的生活小品</span><h2 id="listen-generate-title">今天，想听什么？</h2></div><button type="button" onClick={closeGenerate} aria-label="关闭生成窗口">×</button></header>
      <form onSubmit={event => { event.preventDefault(); void generate(); }}><label htmlFor="listen-topic">主题（可选）</label><input id="listen-topic" value={topic} onChange={event => setTopic(event.target.value)} maxLength={160} placeholder="如：雨天咖啡馆、周末去海边" disabled={generating} /><div className={styles.actions}><button type="submit" className={generating ? styles.creating : undefined} aria-busy={generating} disabled={generating}>{generating ? '正在创作短文...' : '✨ 生成篇章'}</button><button type="button" disabled={generating} onClick={() => void generate(true)}>随机来一篇</button></div></form>
      <p className={styles.notice} role="status">{error || (generating ? '正在生成双语短文，可随时关闭取消。' : '')}</p>
    </section></div>}
  </main>;
}
