'use client';

import { useEffect, useRef, useState } from 'react';
import { getUserLevel, type UserLevel } from '@/lib/level-config';
import { compressOcrImage, ocrSentence } from '@/lib/ocr-image';
import type { VocabItem } from '@/lib/vocab-storage';
import styles from './ocr-vocab.module.css';

export function OcrVocab({ level, suspended, onWord, onClose }: { level: UserLevel; suspended: boolean; onWord: (item: VocabItem) => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookupWord, setLookupWord] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  function close() { sequence.current++; controller.current?.abort(); lookup.current?.abort(); setOpen(false); setBusy(false); setLookupWord(''); setImage(''); setText(''); onClose(); trigger.current?.focus(); }

  useEffect(() => () => { sequence.current++; controller.current?.abort(); lookup.current?.abort(); }, []);
  useEffect(() => {
    lookup.current?.abort(); setLookupWord('');
    setStatus(current => current.startsWith('正在查询') ? '难度已切换，请重新点词查询。' : current);
  }, [level]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (!open || suspended) return;
    panel.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
    // Close only uses refs and state setters; keep focus stable while text arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suspended]);

  async function recognize(file: File) {
    const id = ++sequence.current;
    controller.current?.abort(); lookup.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setOpen(true); setBusy(true); setLookupWord(''); setText(''); setImage(''); setStatus('正在压缩图片…');
    let timeout: number | undefined;
    try {
      const dataUrl = await compressOcrImage(file);
      if (id !== sequence.current) return;
      setImage(dataUrl); setStatus('正在识别英文…');
      timeout = window.setTimeout(() => abort.abort(), 65000);
      const response = await fetch('/api/ocr-vocab', { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'ocr', image: dataUrl, level: getUserLevel() }) });
      const data = await response.json();
      if (id !== sequence.current) return;
      if (abort.signal.aborted) throw new Error('识别超时，请重试。');
      if (!response.ok) throw new Error(data.error || '识别失败，请重试。');
      if (typeof data.text !== 'string') throw new Error('识图返回格式异常，请重试。');
      setText(data.text); setStatus(data.text ? '点选英文单词，查看释义并收入词库。' : '没有发现清晰的英文，请换图或靠近文字重拍。');
    } catch (error) {
      if (id === sequence.current) setStatus(abort.signal.aborted ? '识别超时，请换图或重试。' : error instanceof Error ? error.message : '识别失败，请重试。');
    } finally { window.clearTimeout(timeout); if (id === sequence.current) setBusy(false); }
  }

  async function pick(word: string, offset: number) {
    lookup.current?.abort();
    const abort = new AbortController(); lookup.current = abort;
    const currentLevel = getUserLevel();
    const context = ocrSentence(text, offset);
    setLookupWord(word); setStatus(`正在查询 ${word} · ${currentLevel}…`);
    const timer = window.setTimeout(() => abort.abort(), 65000);
    try {
      const response = await fetch('/api/ocr-vocab', { method: 'POST', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'lookup', word, context, level: currentLevel }) });
      const data = await response.json();
      if (lookup.current !== abort || getUserLevel() !== currentLevel) return;
      if (!response.ok) throw new Error(data.error || '查词失败，请重试。');
      if (abort.signal.aborted) return;
      onWord({ ...data, id: `photo-${Date.now()}-${word.toLowerCase()}`, word, exampleEn: context, level: currentLevel, status: 'in_bank', source: 'manual', addedAt: Date.now() });
      setStatus('点选英文单词，查看释义并收入词库。');
    } catch (error) { if (lookup.current === abort && getUserLevel() === currentLevel) setStatus(abort.signal.aborted ? '查词已取消或超时，请再次点词重试。' : error instanceof Error ? error.message : '查词失败，请重试。'); }
    finally { window.clearTimeout(timer); if (lookup.current === abort) setLookupWord(''); }
  }

  const tokens = [...text.matchAll(/[A-Za-z][A-Za-z'-]*|[^A-Za-z]+/g)];
  return <>
    <button ref={trigger} type="button" className={styles.camera} aria-label="智能识图收词：拍照或相册上传" onClick={() => input.current?.click()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 5l1.5-2h5L16 5h4a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z"/><circle cx="12" cy="12" r="4"/></svg></button>
    <input ref={input} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void recognize(file); }} />
    {open && <div className={styles.backdrop} style={suspended ? { visibility: 'hidden' } : undefined} aria-hidden={suspended || undefined} onClick={close}>
      <section ref={panel} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="ocr-title" onClick={event => event.stopPropagation()}>
        <header className={styles.heading}><h2 id="ocr-title">智能识图收词</h2><button type="button" onClick={close} aria-label="关闭识图">×</button></header>
        <div className={styles.preview}>{image && <img src={image} alt="已选择的识图图片" />}<button type="button" onClick={() => input.current?.click()}>{image ? '重拍 / 换图' : '选择另一张图片'}</button></div>
        <p className={styles.status} role="status" aria-live="polite">{busy && <span className={styles.spinner} />}{status}</p>
        {!busy && !text && image && <button type="button" className={styles.retry} onClick={() => input.current?.click()}>重新选择图片</button>}
        {text && <div className={styles.text} lang="en" aria-label="识别出的英文，点击单词查词">{tokens.map(token => /^[A-Za-z]/.test(token[0]) ? <button type="button" className={styles.wordToken} key={token.index} aria-label={`查询 ${token[0]}`} aria-busy={lookupWord === token[0]} onClick={() => void pick(token[0], token.index!)}>{token[0]}</button> : <span key={token.index}>{token[0]}</span>)}</div>}
      </section>
    </div>}
  </>;
}
