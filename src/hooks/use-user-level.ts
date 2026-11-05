'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_LEVEL, getUserLevel, setUserLevel, LEVEL_EVENT, LEVEL_STORAGE_KEY, type UserLevel } from '@/lib/level-config';

export function useUserLevel() {
  // Identical server/first-client snapshot; read browser storage only after mounting.
  const [level, update] = useState<UserLevel>(DEFAULT_LEVEL);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => update(getUserLevel());
    const changed = (event: Event) => update((event as CustomEvent<UserLevel>).detail);
    const storage = (event: StorageEvent) => { if (event.key === LEVEL_STORAGE_KEY || event.key === null) read(); };
    window.addEventListener(LEVEL_EVENT, changed);
    window.addEventListener('storage', storage);
    read(); setReady(true);
    return () => { window.removeEventListener(LEVEL_EVENT, changed); window.removeEventListener('storage', storage); };
  }, []);
  return { level, ready, setLevel: setUserLevel };
}
