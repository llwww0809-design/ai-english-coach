'use client';
import { useCallback, useEffect, useState } from 'react';
import { ACTIVITY_EVENT, ACTIVITY_KEY, clearActivities, readActivities, type LearningActivity } from '@/lib/activity-storage';
export function useActivities() {
  const [activities, setActivities] = useState<LearningActivity[]>([]);
  const refresh = useCallback(() => { if (typeof window === 'undefined') return; setActivities(readActivities()); }, []);
  useEffect(() => { refresh(); const onStorage = (e: StorageEvent) => { if (e.key === ACTIVITY_KEY || e.key === null) refresh(); }; window.addEventListener('storage', onStorage); window.addEventListener(ACTIVITY_EVENT, refresh); window.addEventListener('focus', refresh); return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(ACTIVITY_EVENT, refresh); window.removeEventListener('focus', refresh); }; }, [refresh]);
  return { activities, clear: clearActivities };
}
