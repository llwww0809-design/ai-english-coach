import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const { parseTopicGeneration } = await loadTs(new URL('../src/lib/topic-generation.ts', import.meta.url));
const { expandTopicVocabulary } = await loadTs(new URL('../src/lib/topic-generation-api.ts', import.meta.url));
const vocab = await loadTs(new URL('../src/lib/vocab-storage.ts', import.meta.url));
const originalFetch = globalThis.fetch;
const extraKey = 'english-coach.vocab.topic-extra.v1';
const words = ['spoon', 'fork', 'knife', 'plate', 'bowl', 'napkin', 'sugar', 'salt', 'pepper', 'tray'].map(word => ({
  word, phonetic: '/test/', translation: '测试释义', collocations: [`a ${word}`, `the ${word}`],
  exampleEn: `A ${word}, please.`, exampleZh: '请给我一个。', level: 'L1',
}));
function browser() {
  const values = new Map();
  const events = [];
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    dispatchEvent: event => events.push(event.type) };
  return { values, events };
}
afterEach(() => { delete globalThis.window; globalThis.fetch = originalFetch; });

test('model JSON supports fenced output and requires exactly ten complete unique matching-level entries', () => {
  assert.equal(parseTopicGeneration('```json\n' + JSON.stringify({ words }) + '\n```', 'L1', []).length, 10);
  for (const rows of [words.slice(1), [...words.slice(1), words[1]], words.map((w, i) => i ? w : { ...w, level: 'L5' }),
    words.map((w, i) => i ? w : { ...w, exampleZh: '' })]) {
    assert.throws(() => parseTopicGeneration(JSON.stringify({ words: rows }), 'L1', []));
  }
  assert.throws(() => parseTopicGeneration(JSON.stringify({ words }), 'L1', [' SPOON ']));
});

test('appended words persist, deduplicate and retain mastery and bank details across reads', () => {
  const { values, events } = browser();
  const base = vocab.getTopicPacks('L1')[0];
  const extra = { ...words[0], word: 'test spoon' };
  assert.equal(vocab.appendTopicWords(base.id, 'L1', [extra]), 1);
  assert.equal(vocab.appendTopicWords(base.id, 'L1', [{ ...extra, word: ' TEST  SPOON ' }, base.words[0]]), 0);
  const restored = vocab.getTopicPacks('L1')[0];
  assert.equal(restored.words.length, base.words.length + 1);
  assert.equal(vocab.getTopicPacks('L2')[0].words.some(w => w.word === extra.word), false);
  assert.equal(vocab.getTopicPacks('L1')[1].words.some(w => w.word === extra.word), false);
  const saved = restored.words.at(-1);
  vocab.markTopicWordMastered(base.id, saved.id);
  assert.ok(vocab.getTopicPackProgress()[base.id].includes(saved.id));
  assert.equal(vocab.getTopicPacks('L1')[0].words.at(-1).id, saved.id);
  vocab.addToBank(saved);
  assert.deepEqual(vocab.getBankList()[0].collocations, extra.collocations);
  assert.equal(vocab.getBankList()[0].exampleEn, extra.exampleEn);
  assert.ok(values.has(`expanded_topic_words_${base.id}_L1`));
  assert.ok(events.includes(vocab.VOCAB_UPDATED_EVENT));
});

test('corrupt storage is safe and failed writes never report successful expansion', () => {
  const { values } = browser();
  const count = vocab.getTopicPacks('L1')[0].words.length;
  for (const invalid of ['{broken', 'null', '[]', '{"coffee-dining":[null,12,{}]}']) {
    values.set(extraKey, invalid);
    assert.equal(vocab.getTopicPacks('L1')[0].words.length, count);
  }
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => vocab.appendTopicWords('coffee-dining', 'L1', [{ ...words[0], word: 'test spoon' }]), /存储/);
  assert.equal(vocab.getTopicPacks('L1')[0].words.length, count);
  assert.throws(() => vocab.appendTopicWords('coffee-dining', 'L1', [{ ...words[0], level: 'L5' }]));
});

test('topic and level partitions survive reloads and subsequent appends independently', async () => {
  const { values } = browser();
  const packs = vocab.getTopicPacks('L1');
  const first = { ...words[0], word: 'test spoon' };
  vocab.appendTopicWords(packs[0].id, 'L1', [first]);
  const key = `expanded_topic_words_${packs[0].id}_L1`;
  const saved = JSON.parse(values.get(key));
  vocab.appendTopicWords(packs[1].id, 'L1', [{ ...first, word: 'test fork' }]);
  vocab.appendTopicWords(packs[0].id, 'L2', [{ ...first, level: 'L2' }]);
  vocab.appendTopicWords(packs[0].id, 'L1', [{ ...first, word: 'test plate' }]);
  const reloaded = await loadTs(new URL('../src/lib/vocab-storage.ts', import.meta.url));
  const restored = reloaded.getTopicPacks('L1')[0].words;
  assert.equal(restored.length, packs[0].words.length + 2);
  assert.deepEqual(restored.find(w => w.id === saved[0].id), saved[0]);
  assert.equal(reloaded.getTopicPacks('L2')[0].words.filter(w => w.word === first.word).length, 1);
  assert.equal(reloaded.getTopicPacks('L1')[1].words.at(-1).word, 'test fork');
  values.set(key, '{broken');
  assert.equal(reloaded.getTopicPacks('L1')[1].words.at(-1).word, 'test fork');
  assert.equal(reloaded.getTopicPacks('L2')[0].words.at(-1).word, first.word);
});

test('legacy expansion migrates without changing IDs or losing mastery and details', () => {
  const { values } = browser();
  const legacy = { ...words[0], word: 'test spoon', id: 'topic-extra-legacy', status: 'in_bank', source: 'daily_recommend', addedAt: 123 };
  values.set(extraKey, JSON.stringify({ 'coffee-dining': [legacy] }));
  values.set('english-coach.vocab.topic-progress.v1', JSON.stringify({ 'coffee-dining': [legacy.id] }));
  assert.deepEqual(vocab.getTopicPacks('L1')[0].words.at(-1), legacy);
  assert.deepEqual(JSON.parse(values.get('expanded_topic_words_coffee-dining_L1')), [legacy]);
  assert.ok(vocab.getTopicPackProgress()['coffee-dining'].includes(legacy.id));
  assert.ok(values.has(extraKey));
  assert.equal(vocab.appendTopicWords('coffee-dining', 'L1', [legacy]), 0);
  values.delete('expanded_topic_words_coffee-dining_L1');
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.equal(vocab.getTopicPacks('L1')[0].words.at(-1).id, legacy.id);
});

test('mastery can be undone, persists independently and fails visibly when storage is denied', () => {
  const { values } = browser();
  const pack = vocab.getTopicPacks('L1')[0];
  const [first, second] = pack.words;
  vocab.markTopicWordMastered(pack.id, first.id);
  vocab.markTopicWordMastered(pack.id, second.id);
  vocab.setTopicWordMastered(pack.id, first.id, false);
  assert.deepEqual(vocab.getTopicPackProgress()[pack.id], [second.id]);
  assert.equal(vocab.getBankList().length, 0);
  const before = values.get('english-coach.vocab.topic-progress.v1');
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => vocab.setTopicWordMastered(pack.id, second.id, false), /保存失败/);
  assert.equal(values.get('english-coach.vocab.topic-progress.v1'), before);
  assert.deepEqual(vocab.getTopicPackProgress()[pack.id], [second.id]);
});

test('generation API uses non-stream JSON, current level, curated exclusions and server credentials', async () => {
  const fresh = words.map((w, i) => ({ ...w, word: `new word ${String.fromCharCode(97 + i)}` }));
  let sent;
  globalThis.fetch = async (url, options) => {
    sent = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    assert.ok(url.endsWith('/chat/completions'));
    return Response.json({ choices: [{ message: { content: JSON.stringify({ words: fresh }) } }] });
  };
  const result = await expandTopicVocabulary({ topicId: 'coffee-dining', level: 'L1', excludeWords: ['custom word'] }, 'test-secret', new AbortController().signal);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).words.length, 10);
  assert.equal(sent.stream, false);
  assert.ok(sent.messages[1].content.includes('custom word'));
  assert.ok(sent.messages[1].content.includes('menu'));
  assert.ok(sent.messages[1].content.includes('L1'));
});

test('generation API rejects invalid input, duplicates, upstream errors and cancellation safely', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  const invalid = await expandTopicVocabulary({ topicId: 'unknown', level: 'L1', excludeWords: [] }, 'key', new AbortController().signal);
  assert.equal(invalid.status, 400); assert.equal(calls, 0);
  const body = { topicId: 'coffee-dining', level: 'L1', excludeWords: [] };
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ words: words.map(w => ({ ...w, word: 'menu' })) }) } }] });
  assert.equal((await expandTopicVocabulary(body, 'key', new AbortController().signal)).status, 502);
  globalThis.fetch = async () => new Response('provider error', { status: 429 });
  assert.equal((await expandTopicVocabulary(body, 'key', new AbortController().signal)).status, 502);
  globalThis.fetch = async (_url, options) => { options.signal.throwIfAborted(); return Response.json({}); };
  const controller = new AbortController(); controller.abort();
  assert.equal((await expandTopicVocabulary(body, 'key', controller.signal)).status, 502);
});
