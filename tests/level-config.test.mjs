import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTs } from './load-ts.mjs';
const config = await loadTs(new URL('../src/lib/level-config.ts', import.meta.url));
const ai = await loadTs(new URL('../src/lib/ai-client.ts', import.meta.url));
const originalFetch = globalThis.fetch;
function browser() {
  const values = new Map(); const bus = new EventTarget();
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, dispatchEvent: event => bus.dispatchEvent(event) };
  return { values, bus };
}
afterEach(() => { delete globalThis.window; globalThis.fetch = originalFetch; });
test('SSR is safe and old CEFR storage migrates to the canonical key', () => {
  assert.equal(config.getUserLevel(), 'L3');
  const { values } = browser();
  values.set('english-coach.level.v1', 'A2');
  assert.equal(config.getUserLevel(), 'L2');
  assert.equal(values.get('ai_english_user_level'), 'L2');
  values.set('ai_english_user_level', 'L5');
  assert.equal(config.getUserLevel(), 'L5');
});
test('setter broadcasts actual level to every mounted subscriber and persists once', () => {
  const { values, bus } = browser(); const first = []; const second = [];
  bus.addEventListener('app-level-changed', event => first.push(event.detail));
  bus.addEventListener('app-level-changed', event => second.push(event.detail));
  config.setUserLevel('L1'); config.setUserLevel('L4');
  assert.deepEqual(first, ['L1', 'L4']); assert.deepEqual(second, first);
  assert.equal(values.get(config.LEVEL_STORAGE_KEY), 'L4');
});
test('chat request uses current global level even when a caller passes an obsolete session level', async () => {
  const { values } = browser(); values.set(config.LEVEL_STORAGE_KEY, 'L5');
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
  await ai.requestAiReply([{ role: 'user', content: 'Hi' }], undefined, undefined, undefined, undefined, 'L1');
  assert.equal(body.level, 'L5');
});
test('storage denial still supports current-tab selection and event delivery', () => {
  const { bus } = browser(); let observed;
  window.localStorage.setItem = () => { throw new Error('storage denied'); };
  bus.addEventListener(config.LEVEL_EVENT, event => { observed = event.detail; });
  config.setUserLevel('L2');
  assert.equal(observed, 'L2'); assert.equal(config.getUserLevel(), 'L2');
});
