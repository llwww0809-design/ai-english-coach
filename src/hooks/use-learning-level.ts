'use client';
import { useUserLevel } from './use-user-level';
import { isLearningLevel, normalizeLearningLevel } from '@/lib/level-config';
// Legacy UI adapter. Never read or write a separate storage key here.
export function useLearningLevel() {
  const { level, ready, setLevel } = useUserLevel();
  const selectLevel = (value: string) => {
    if (isLearningLevel(value) || ['A1', 'A2', 'B1', 'B2', 'C1'].includes(value)) setLevel(normalizeLearningLevel(value));
  };
  return { level, ready, selectLevel };
}
