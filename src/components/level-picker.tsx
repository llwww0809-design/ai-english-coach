'use client';
import { learningLevels } from '@/lib/levels';
import { useLearningLevel } from '@/hooks/use-learning-level';
import styles from './level-picker.module.css';

export function LevelPicker() {
  const { level, selectLevel } = useLearningLevel();
  return <label className={styles.control}><span>当前等级</span><select aria-label="英语学习难度等级" value={level} onChange={event => selectLevel(event.target.value)}>{learningLevels.map(item => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label>;
}
