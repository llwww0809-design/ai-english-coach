'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useListeningAudio } from '@/hooks/use-listening-audio';
import { useModalFocus } from '@/hooks/use-modal-focus';
import { getUserLevel } from '@/lib/level-config';
import type { SlowArticle } from '@/lib/listening-storage';
import { addToBank, getBankList, VOCAB_UPDATED_EVENT, type VocabItem } from '@/lib/vocab-storage';
import styles from './article-player.module.css';

export function ArticlePlayer({ article, onClose }: { article: SlowArticle; onClose: () => void }) {
  const audio = useListeningAudio(article);
  const panel = useRef<HTMLElement>(null);
  const activeLine = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const [word, setWord] = useState<VocabItem | null>(null);
  const [lookup, setLookup] = useState('');
  const [message, setMessage] = useState('');
  const [bank, setBank] = useState<VocabItem[]>([]);
  const closeWord = useCallback(() => { request.current?.abort(); request.current = null; audio.pause(); setWord(null); setLookup(''); setMessage(''); panel.current?.focus(); }, [audio.pause]);
  const close = useCallback(() => { request.current?.abort(); request.current = null; onClose(); }, [onClose]);
  const escape = useCallback(() => { if (word || lookup) closeWord(); else close(); }, [word, lookup, closeWord, close]);
  useModalFocus(panel, true, escape);

  useEffect(() => {
    const refresh = () => setBank(getBankList());
    refresh(); window.addEventListener(VOCAB_UPDATED_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { request.current?.abort(); request.current = null; window.removeEventListener(VOCAB_UPDATED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => {
    if (!word) activeLine.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }, [audio.index, word]);

  async function pick(value: string, context: string) {
    audio.pause(); request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setWord(null); setLookup(value); setMessage('');
    const level = getUserLevel();
    const timer = window.setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch('/api/ocr-vocab', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'lookup', word: value, context, level }) });
      const data = await response.json();
      if (request.current !== controller) return;
      if (controller.signal.aborted) throw new Error('查词超时，请重试。');
      if (!response.ok) throw new Error(data.error || '查词失败，请重试。');
      if (getUserLevel() !== level) return;
      setWord({ ...data, id: `listen-word-${Date.now()}`, word: value, level, exampleEn: context, source: 'chat_pick', status: 'in_bank', addedAt: Date.now() });
      panel.current?.focus();
    } catch (error) { if (request.current === controller) setMessage(controller.signal.aborted ? '查词超时，请重新点击单词。' : error instanceof Error ? error.message : '暂时无法查词。'); }
    finally { window.clearTimeout(timer); if (request.current === controller) setLookup(''); }
  }
  const saved = Boolean(word && bank.some(item => item.level === word.level && item.word.toLowerCase() === word.word.toLowerCase()));
  function save() {
    if (!word) return;
    try { addToBank({ ...word, status: 'in_bank' }); setBank(getBankList()); setMessage('已加入我的词库'); }
    catch { setMessage('保存失败，请检查本地存储空间后重试。'); }
  }

  return <div className={styles.backdrop} onClick={close}>
    <section className={styles.player} ref={panel} role="dialog" aria-modal="true" aria-labelledby="listen-player-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <header className={styles.header}>
        <div><span>{article.level} · {word ? '语境词典' : article.category}</span><h2 id="listen-player-title">{word ? word.word : article.titleEn}</h2><small>{word ? word.phonetic : article.titleZh}</small></div>
        <button type="button" className={styles.close} onClick={word ? closeWord : close} aria-label={word ? '返回篇章' : '关闭播放器'}>{word ? '←' : '×'}</button>
      </header>
      {word ? <>
        <div className={styles.wordDetail}>
          <button type="button" className={styles.sound} disabled={audio.state === 'loading'} aria-busy={audio.state === 'loading'} onClick={() => audio.preview(word.word)}>{audio.state === 'loading' ? <span className="audioSpinner" aria-hidden="true" /> : '🔊'} Jenny 发音</button>
          <section><h3>中文释义</h3><p>{word.translation}</p></section>
          <section><h3>常用搭配 · {word.level}</h3><div className={styles.tags}>{word.collocations.map(tag => <span key={tag}>{tag}</span>)}</div></section>
          <section><h3>原文语境 <button type="button" className={styles.sound} aria-label="朗读原文例句" disabled={audio.state === 'loading'} aria-busy={audio.state === 'loading'} onClick={() => audio.preview(word.exampleEn)}>{audio.state === 'loading' ? <span className="audioSpinner" aria-hidden="true" /> : '🔊'}</button></h3><p lang="en">{word.exampleEn}</p><small>{word.exampleZh}</small></section>
        </div>
        <footer className={styles.wordFooter}><button type="button" disabled={saved} onClick={save}>{saved ? '✓ 已加入我的词库' : '+ 加入我的词库'}</button><button type="button" className={styles.secondary} onClick={closeWord}>返回听读</button></footer>
      </> : <>
        <div className={styles.speedRow}><div role="group" aria-label="朗读语速">{[0.8, 1].map(speed => <button type="button" key={speed} aria-pressed={audio.speed === speed} onClick={() => audio.changeSpeed(speed)}>{speed.toFixed(1)}x {speed === 0.8 ? '慢速' : '原速'}</button>)}</div><span>{audio.index + 1} / {article.sentences.length}</span></div>
        <div className={styles.transcript}>{article.sentences.map((sentence, index) => <div ref={index === audio.index ? activeLine : undefined} key={sentence.id} className={`${styles.sentence} ${index === audio.index ? styles.current : ''}`} aria-current={index === audio.index ? 'step' : undefined}>
          <p lang="en">{sentence.en.split(/([A-Za-z][A-Za-z'-]*)/g).map((token, at) => /^[A-Za-z][A-Za-z'-]*$/.test(token) ? <button type="button" className={styles.wordToken} key={at} aria-label={`查询 ${token}`} onClick={() => void pick(token, sentence.en)}>{token}</button> : <span key={at}>{token}</span>)}</p>
          <small>{sentence.zh}</small>
        </div>)}</div>
        <footer className={styles.controls}><button type="button" disabled={audio.state === 'loading' || audio.index === 0} onClick={() => audio.playAt(audio.index - 1)} aria-label="上一句">⏮</button><button type="button" className={styles.play} disabled={audio.state === 'loading'} aria-busy={audio.state === 'loading'} onClick={() => void audio.toggle()} aria-label={audio.state === 'playing' || audio.state === 'loading' ? '暂停' : '播放'}>{audio.state === 'loading' ? <><span className="audioSpinner" aria-hidden="true" /> 准备语音…</> : audio.state === 'playing' ? 'Ⅱ 暂停' : audio.state === 'finished' ? '↻ 再听一次' : '▶ 播放'}</button><button type="button" disabled={audio.state === 'loading' || audio.index === article.sentences.length - 1} onClick={() => audio.playAt(audio.index + 1)} aria-label="下一句">⏭</button></footer>
      </>}
      <p className={styles.status} role="status">{lookup ? `正在查词：${lookup}…` : message || audio.error || (audio.state === 'loading' ? '正在准备 Jenny 语音…' : audio.state === 'finished' ? '本篇听读完成 ✓' : '')}</p>
    </section>
  </div>;
}
