import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const vocab = await loadTs(new URL('../src/lib/vocab-storage.ts', import.meta.url));
const topicKey = 'english-coach.vocab.topic-progress.v1';
const storageKey = 'english-coach.vocab.v1';
const levels = ['L1', 'L2', 'L3', 'L4', 'L5'];
function browser() {
  const values = new Map();
  const events = [];
  globalThis.window = {
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: event => { events.push(event.type); return true; },
  };
  return { values, events };
}
afterEach(() => { delete globalThis.window; });

test('server rendering reads safely without browser globals', () => {
  assert.deepEqual(vocab.getBankList(), []);
  assert.deepEqual(vocab.getTopicPackProgress(), {});
  for (const level of levels) assert.equal(vocab.getDailyRecommendations(level).length, 10);
});

test('every theme provides complete independent content at all five difficulties', () => {
  const allIds = new Set();
  for (const level of levels) {
    const packs = vocab.getTopicPacks(level);
    assert.equal(packs.length, 6);
    assert.deepEqual(new Set(packs.map(pack => pack.category)), new Set(['daily', 'travel', 'work', 'exam']));
    for (const pack of packs) {
      assert.equal(pack.level, undefined); // Themes carry no fixed difficulty.
      assert.ok(pack.words.length >= 15 && pack.words.length <= 20, `${pack.id}/${level}: ${pack.words.length} words`);
      assert.equal(new Set(pack.words.map(word => word.word.trim().toLowerCase())).size, pack.words.length);
      for (const word of pack.words) {
        assert.equal(word.level, level);
        assert.ok(!allIds.has(word.id)); allIds.add(word.id);
        for (const field of ['word', 'phonetic', 'translation', 'exampleEn', 'exampleZh']) assert.ok(word[field].trim());
        assert.ok(word.collocations.length >= 2);
      }
    }
  }
  assert.ok(vocab.getTopicPacks('L1')[0].words.some(word => word.word === 'menu'));
  assert.ok(vocab.getTopicPacks('L4')[0].words.some(word => word.word === 'dietary restrictions'));
});

test('passing survives reload, deduplicates progress and rejects foreign word IDs', () => {
  const { values, events } = browser();
  const pack = vocab.getTopicPacks()[0];
  const word = pack.words[0];
  vocab.markTopicWordMastered(pack.id, word.id);
  vocab.markTopicWordMastered(pack.id, word.id);
  vocab.markTopicWordMastered(pack.id, 'not-in-this-pack');
  assert.deepEqual(vocab.getTopicPackProgress()[pack.id], [word.id]);
  assert.deepEqual(JSON.parse(values.get(topicKey))[pack.id], [word.id]);
  assert.ok(events.includes(vocab.VOCAB_UPDATED_EVENT));
  for (const item of pack.words) vocab.markTopicWordMastered(pack.id, item.id);
  assert.equal(vocab.getTopicPackProgress()[pack.id].length, pack.words.length);
  assert.deepEqual(vocab.getBankList(), []);
});

test('unknown topic words enter an initially empty bank with usage intact and no duplicate entries', () => {
  browser();
  assert.deepEqual(vocab.getBankList(), []);
  const word = vocab.getTopicPacks()[0].words[0];
  vocab.addToBank(word);
  vocab.addToBank(word);
  const [saved] = vocab.getBankList();
  assert.equal(vocab.getBankList().length, 1);
  assert.equal(saved.word, word.word);
  assert.equal(saved.level, word.level);
  assert.deepEqual(saved.collocations, word.collocations);
  assert.equal(saved.exampleEn, word.exampleEn);
  assert.equal(saved.exampleZh, word.exampleZh);
  assert.ok(saved.addedAt > 0);
  vocab.removeFromBank(saved.id);
  assert.deepEqual(vocab.getBankList(), []);
});

test('daily progress restores by date and level; all five levels retain ten complete recommendations', () => {
  browser();
  for (const level of levels) {
    const words = vocab.getDailyRecommendations(level);
    assert.equal(words.length, 10);
    assert.ok(words.every(word => word.level === level && word.collocations.length >= 2 && word.exampleEn && word.exampleZh));
    if (level === 'L1' || level === 'L2') assert.ok(words.filter(word => word.word.includes(' ')).length <= 3);
    for (const word of words.slice(0, 3)) vocab.markDailyHandled(word.id, 'passed', level);
    assert.equal(vocab.getDailyRecommendState(level).currentIndex, 3);
    assert.equal(vocab.getDailyRecommendState(level).currentIndex, 3);
    for (const word of words.slice(3)) vocab.markDailyHandled(word.id, 'added', level);
    assert.equal(vocab.getDailyRecommendState(level).currentIndex, 10);
  }
});

test('corrupt or obsolete topic progress cannot inflate mastery counts', () => {
  const { values } = browser();
  const pack = vocab.getTopicPacks()[0];
  values.set(topicKey, JSON.stringify({ [pack.id]: [pack.words[0].id, pack.words[0].id, 'obsolete', 12] }));
  assert.deepEqual(vocab.getTopicPackProgress()[pack.id], [pack.words[0].id]);
  for (const invalid of ['null', '[]', '{broken']) {
    values.set(topicKey, invalid);
    assert.deepEqual(vocab.getTopicPackProgress(), {});
  }
  values.set(storageKey, '{broken');
  assert.deepEqual(vocab.getBankList(), []);
});

test('mastery and bank metadata stay separate across difficulty changes', () => {
  browser();
  const easy = vocab.getTopicPacks('L1')[0];
  const advanced = vocab.getTopicPacks('L5')[0];
  vocab.markTopicWordMastered(easy.id, easy.words[0].id);
  let known = vocab.getTopicPackProgress()[easy.id];
  assert.equal(advanced.words.filter(word => known.includes(word.id)).length, 0);
  vocab.markTopicWordMastered(advanced.id, advanced.words[0].id);
  assert.equal(vocab.getTopicPackProgress()[easy.id].length, 2);
  vocab.addToBank(easy.words[0]);
  vocab.addToBank({ ...advanced.words[0], word: easy.words[0].word });
  assert.equal(vocab.getBankList().length, 2);
  assert.equal(vocab.getBankList().find(word => word.level === 'L1').exampleEn, easy.words[0].exampleEn);
});

test('daily switching restores each level batch instead of resetting it', () => {
  browser();
  const easy = vocab.getDailyRecommendations('L1');
  vocab.markDailyHandled(easy[0].id, 'added', 'L1');
  const advanced = vocab.getDailyRecommendations('L5');
  vocab.markDailyHandled(advanced[0].id, 'passed', 'L5');
  assert.equal(vocab.getDailyRecommendState('L1').currentIndex, 1);
  assert.equal(vocab.getDailyRecommendState('L5').currentIndex, 1);
});

test('existing topic word IDs remain stable after expanding the library', () => {
  assert.equal(vocab.getTopicPacks('L1')[0].words[0].id, 'coffee-dining-L1-0');
  assert.equal(vocab.getTopicPacks('L1')[0].words[0].word, 'menu');
  assert.equal(vocab.getTopicPacks('L1')[0].words[3].word, 'bill');
  for (const level of levels) {
    for (const pack of vocab.getTopicPacks(level)) {
      assert.ok(pack.words.some(word => word.id === `${pack.id}-${level}-14`));
    }
  }
});
