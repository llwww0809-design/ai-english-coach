import type { ExpressionFeedback } from '@/lib/feedback';
import styles from './expression-feedback.module.css';

export function ExpressionFeedbackCard({ feedback, state, onSave, saved = false }: { feedback?: ExpressionFeedback; state?: 'pending' | 'unavailable'; onSave?: () => void; saved?: boolean }) {
  if (!feedback) {
    if (!state) return null;
    return <div className={styles.status} role="status">口语地道表达建议 · {state === 'pending' ? '整理中…' : '暂未获取，可继续练习'}</div>;
  }
  const perfect = feedback.status === 'perfect';
  return <details className={`${styles.card} ${perfect ? styles.perfect : styles.improve}`}>
    <summary><span>老外日常这么说</span><span className={styles.badge}>{perfect ? '表达很自然' : '口语小建议'}</span><span className={styles.arrow} aria-hidden="true">⌄</span></summary>
    <div className={styles.body}>
      {!perfect && <div><span className={styles.label}>建议修改为：</span><p lang="en" className={styles.english}>{feedback.correction}</p></div>}
      {feedback.suggestion && <div><span className={styles.label}>{perfect ? '进阶表达' : '也可以这样说'}</span><div className={styles.suggestionLine}><p lang="en" className={styles.english}>{feedback.suggestion}</p>{onSave && <button type="button" className={`${styles.saveButton} ${saved ? styles.saved : ''}`} onClick={onSave} disabled={saved} aria-label={saved ? '已收藏到口语词库' : '收藏到口语词库'} title={saved ? '已收藏' : '收藏到口语词库'}>{saved ? '▣' : '＋'}</button>}</div></div>}
      {feedback.explanation && <p className={styles.explanation}>{feedback.explanation}</p>}
    </div>
  </details>;
}
