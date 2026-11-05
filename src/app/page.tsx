'use client';
import { useRouter } from 'next/navigation';
import { useLearningData } from '@/hooks/use-learning-data';
import { useActivities } from '@/hooks/use-activities';
import { reviewWords } from '@/lib/vocabulary';
import styles from './home.module.css';

export default function Home() {
  const router = useRouter();
  const { data, ready, todayCount } = useLearningData();
  const { activities } = useActivities();
  const nextWord = reviewWords.find(word => data.queue.includes(word.word));
  const todayTalks = activities.filter(item => (item.type === 'teacher' || item.type === 'scenario') && item.createdAt.slice(0, 10) === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })).length;
  return <main className={styles.page}>
    <header className={styles.header}><a href="/" className={styles.brand}>✳ <span>AI English Coach</span></a></header>
    <section className={styles.welcome}><span className={styles.eyebrow}>A LITTLE BETTER, EVERY DAY</span><h1>今天，想从哪句话开始？</h1><p>不用准备很久，先说一句就很好。</p></section>
    <section className={styles.today}><div className={styles.todayCopy}><span className={styles.eyebrow}>TODAY</span><h2>今日练习</h2><p>{todayTalks ? `今天已经完成 ${todayTalks} 次对话练习。` : '用几分钟，给英语一点时间。'}</p><button onClick={() => router.push('/teacher')}>开始开口 <span>↗</span></button></div><div className={styles.progress}><strong>{ready ? todayCount : '—'}<small> / 6</small></strong><span>今日掌握词汇</span><div><i style={{ width: `${Math.min(100, todayCount / 6 * 100)}%` }} /></div><button className={styles.wordLink} onClick={() => router.push('/words')}>{data.queue.length} 个待复习 →</button></div></section>
    <section className={styles.recent}><div><div><span className={styles.eyebrow}>RECENT WORDS</span><h2>最近生词</h2></div><button onClick={() => router.push('/profile#vocabulary')}>查看生词本 ↗</button></div>{nextWord ? <button className={styles.word} onClick={() => router.push('/words')}><b>{nextWord.word}</b><span>{nextWord.phonetic}</span><small>{nextWord.meaning}</small><i>去复习 →</i></button> : <p className={styles.empty}>本轮单词已复习完成，做得很好。</p>}</section>
    <footer className={styles.footer}>SMALL STEPS, STEADY PROGRESS</footer>
  </main>;
}
