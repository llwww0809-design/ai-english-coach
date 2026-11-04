'use client';
import Link from 'next/link';
import { useActivities } from '@/hooks/use-activities';
import { useLearningData } from '@/hooks/use-learning-data';
import styles from './records.module.css';

export default function RecordsPage() {
  const { activities, clear } = useActivities();
  const { data } = useLearningData();
  const practiceDays = new Set(activities.map(item => item.createdAt.slice(0, 10))).size;
  const wordCount = data.mastered.length;
  const conversationCount = activities.filter(item => item.type === 'teacher' || item.type === 'scenario').length;
  function reset() { if (window.confirm('清空全部学习记录？这不会删除单词掌握状态，但学习动态和对话统计将被清空。')) clear(); }
  return <main className={styles.page}><div className={styles.wrap}><header className={styles.header}><Link href="/" className={styles.back}>←</Link><div><span className={styles.eyebrow}>YOUR LEARNING JOURNEY</span><h1>学习记录</h1></div><span className={styles.spark}>✳</span></header>
    <p className={styles.lead}>每一次练习，都会成为你正在进步的证据。</p>
    <section className={styles.overview}><div><b>{practiceDays}</b><span>总练习天数</span></div><div><b>{wordCount}</b><span>累计学习单词数</span></div><div><b>{conversationCount}</b><span>累计对话练习次数</span></div></section>
    <section className={styles.section}><div className={styles.sectionTitle}><div><span className={styles.eyebrow}>RECENT ACTIVITY</span><h2>最近学习动态</h2></div><span>{activities.length} 条记录</span></div>{activities.length === 0 ? <div className={styles.empty}>还没有学习动态<br/><small>去完成一次单词复习或对话练习吧。</small></div> : <div className={styles.list}>{activities.map(item => <article key={item.id}><span className={styles.activityIcon}>{item.type === 'teacher' ? '✦' : item.type === 'scenario' ? '◌' : '▤'}</span><div><b>{item.title}</b><p>{item.detail}</p><time>{new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div></article>)}</div>}</section>
    <section className={styles.manage}><div><h2>数据管理</h2><p>学习记录只保存在当前浏览器中。</p></div><button onClick={reset}>清空全部学习记录</button></section><Link href="/" className={styles.homeLink}>返回首页 <span>↗</span></Link>
  </div></main>;
}
