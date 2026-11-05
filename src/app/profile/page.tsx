'use client';
import Link from 'next/link';
import { useUserLevel } from '@/hooks/use-user-level';
import { useActivities } from '@/hooks/use-activities';
import { useEffect, useState } from 'react';
import { learningLevels } from '@/lib/level-config';
import { AUTO_TTS_EVENT, getAutoTtsEnabled, setAutoTtsEnabled } from '@/lib/speech-preferences';
import { getVocabList, VOCAB_UPDATED_EVENT, type VocabItem } from '@/lib/vocab-storage';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { activities } = useActivities();
  const { level, setLevel, ready } = useUserLevel();
  const [autoTts, setAutoTts] = useState(true);
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  useEffect(() => {
    const sync = () => setAutoTts(getAutoTtsEnabled());
    sync();
    window.addEventListener(AUTO_TTS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(AUTO_TTS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    const sync = () => setVocab(getVocabList());
    sync();
    window.addEventListener(VOCAB_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(VOCAB_UPDATED_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const practiceDays = new Set(activities.map(item => item.createdAt.slice(0, 10))).size;
  const talks = activities.filter(item => item.type === 'teacher' || item.type === 'scenario').length;
  const words = vocab.filter(item => item.status === 'in_bank').slice(0, 3);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}>✳ <span>AI English Coach</span></Link></header>
    <section className={styles.intro}><span className={styles.eyebrow}>YOUR LEARNING SPACE</span><h1>我的学习</h1><p>进度、词汇与练习偏好，都在这里。</p></section>
    <section className={styles.stats} aria-label="学习统计"><article className={styles.statCard}><b>{practiceDays}</b><span>练习天数</span></article><article className={styles.statCard}><b>{vocab.filter(item => item.status === 'mastered').length}</b><span>掌握词汇</span></article><article className={styles.statCard}><b>{talks}</b><span>对话练习</span></article></section>
    <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>VOCABULARY</span><h2>最近待复习</h2></div><Link href="/vocab">打开口语词库 ↗</Link></div>{words.length ? <div className={styles.words}>{words.map(word => <Link href="/vocab" className={styles.wordCard} key={word.id}><span className={styles.wordCopy}><span className={styles.wordHeading}><b>{word.word}</b><small>{word.phonetic || ' '}</small></span><span className={styles.meaning}>{word.translation}</span></span><span className={styles.reviewAction}>复习 <span aria-hidden="true">→</span></span></Link>)}</div> : <div className={styles.empty}>这一组口语表达已全部掌握。</div>}</section>
    <section className={styles.section} aria-labelledby="level-heading"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>SPEAKING GOAL</span><h2 id="level-heading">口语难度目标</h2></div></div><div className={styles.levels} role="radiogroup" aria-label="选择口语难度">{learningLevels.map(item => <label key={item.id} className={`${styles.levelCard} ${level === item.id ? styles.levelSelected : ''}`}><input type="radio" name="learning-level" value={item.id} checked={level === item.id} disabled={!ready} onChange={() => setLevel(item.id)} /><span className={styles.levelBadge}>{item.id}</span><span className={styles.levelText}><b>{item.cefr} · {item.name}</b><small>{item.detail}</small></span><span className={styles.levelCheck} aria-hidden="true">{level === item.id ? '✓' : ''}</span></label>)}</div><p className={styles.levelNote}>等级会自动用于 AI 对话和语音朗读。</p></section>
    <section className={styles.section} aria-labelledby="speech-heading"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>VOICE PREFERENCE</span><h2 id="speech-heading">语音偏好</h2></div></div><label className={styles.preferenceCard}><span><b>AI 回复自动朗读</b><small>Jenny 回复后自动播放英语语音</small></span><input type="checkbox" role="switch" checked={autoTts} onChange={event => { try { setAutoTtsEnabled(event.target.checked); setAutoTts(event.target.checked); } catch { setAutoTts(getAutoTtsEnabled()); } }} aria-label="AI 回复自动朗读" /></label></section>
    <nav className={styles.links} aria-label="学习管理"><Link href="/records">查看完整学习记录 <span>↗</span></Link><Link href="/vocab">继续复习口语表达 <span>↗</span></Link></nav>
  </main>;
}
