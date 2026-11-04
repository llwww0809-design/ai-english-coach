import type { ExpressionFeedback } from '@/lib/feedback';
import styles from './expression-feedback.module.css';

export function ExpressionFeedbackCard({ feedback, state }: { feedback?: ExpressionFeedback; state?: 'pending' | 'unavailable' }) {
  if (!feedback) {
    if (!state) return null;
    return <div className={styles.status} role="status">💡 表达分析 · {state === 'pending' ? '分析中…' : '暂未获取，可继续练习'}</div>;
  }
  const perfect = feedback.status === 'perfect';
  return <details className={`${styles.card} ${perfect ? styles.perfect : styles.improve}`}>
    <summary><span>💡 表达分析</span><span className={styles.badge}>{perfect ? '表达非常地道！' : '可以更自然'}</span><span className={styles.arrow} aria-hidden="true">⌄</span></summary>
    <div className={styles.body}>
      {!perfect && <div><span className={styles.label}>建议修改为：</span><p lang="en" className={styles.english}>{feedback.correction}</p></div>}
      {feedback.suggestion && <div><span className={styles.label}>{perfect ? '进阶表达' : '也可以这样说'}</span><p lang="en" className={styles.english}>{feedback.suggestion}</p></div>}
      {feedback.explanation && <p className={styles.explanation}>{feedback.explanation}</p>}
    </div>
  </details>;
}
