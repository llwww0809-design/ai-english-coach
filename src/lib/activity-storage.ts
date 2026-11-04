export type LearningActivity = { id: string; type: 'teacher' | 'scenario' | 'words'; title: string; detail: string; createdAt: string; count?: number };
export const ACTIVITY_KEY = 'english-coach.activities.v1';
export const ACTIVITY_EVENT = 'english-coach-activity-change';

export function readActivities(): LearningActivity[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.createdAt === 'string') : [];
  } catch { return []; }
}

export function addActivity(activity: Omit<LearningActivity, 'id' | 'createdAt'>) {
  const next: LearningActivity = { ...activity, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString() };
  const activities = [next, ...readActivities()].slice(0, 200);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
  window.dispatchEvent(new Event(ACTIVITY_EVENT));
}

export function clearActivities() { localStorage.removeItem(ACTIVITY_KEY); window.dispatchEvent(new Event(ACTIVITY_EVENT)); }
