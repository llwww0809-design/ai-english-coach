import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const vocab = await loadTs(new URL('../src/lib/vocab-storage.ts', import.meta.url));
const topicKey = 'english-coach.vocab.topic-progress.v1';
const storageKey = 'english-coach.vocab.v1';
const levels = ['L1', 'L2', 'L3', 'L4', 'L5'];
const RealDate = Date;
function day(value) {
  const instant = new RealDate(value + 'T12:00:00').getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return instant; }
  };
}
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
afterEach(() => { delete globalThis.window; globalThis.Date = RealDate; });

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

test('each level supplies at least 30 complete single words with stable unique IDs', () => {
  for (const level of levels) {
    const pool = vocab.getDailyWordPool(level);
    assert.ok(pool.filter(item => !item.word.includes(' ')).length >= 30, level);
    assert.equal(new Set(pool.map(item => item.id)).size, pool.length);
    assert.equal(new Set(pool.map(item => item.word.toLowerCase())).size, pool.length);
    for (const item of pool) {
      assert.equal(item.level, level);
      assert.ok(item.phonetic && item.translation && item.collocations.length >= 2 && item.exampleEn && item.exampleZh);
    }
  }
});

test('both daily actions persist deduplicated exclusion history immediately and ignore invalid IDs', () => {
  const {values} = browser();
  const words = vocab.getDailyRecommendations('L2');
  vocab.markDailyHandled(words[0].id, 'passed', 'L2');
  assert.deepEqual(JSON.parse(values.get('seen_vocab_ids')).L2, [words[0].id]);
  vocab.markDailyHandled(words[1].id, 'added', 'L2');
  vocab.markDailyHandled(words[0].id, 'added', 'L2');
  vocab.markDailyHandled('unknown', 'passed', 'L2');
  assert.deepEqual(vocab.getSeenVocabIds().L2, [words[0].id, words[1].id]);
  assert.deepEqual(vocab.getSeenVocabIds().L1, []);
  assert.equal(vocab.getDailyRecommendState('L2').currentIndex, 2);
  assert.equal(vocab.getDailyRecommendState('L2').handled[words[0].id], 'passed');
});

test('successive days never repeat a processed word and stop when fewer than ten remain', () => {
  browser();
  for (const level of levels) {
    const seen = new Set();
    const size = vocab.getDailyWordPool(level).length;
    const batches = Math.floor(size / 10);
    for (let index = 0; index < batches; index++) {
      day(`2026-11-${String(index + 1).padStart(2, '0')}`);
      const words = vocab.getDailyRecommendations(level);
      assert.equal(words.length, 10);
      assert.deepEqual(vocab.getDailyRecommendations(level), words); // Refresh never rerolls.
      for (const [position, word] of words.entries()) {
        assert.ok(!seen.has(word.id), `${level}: repeated ${word.word}`);
        seen.add(word.id);
        vocab.markDailyHandled(word.id, position % 2 ? 'added' : 'passed', level);
      }
    }
    day(`2026-11-${String(batches + 1).padStart(2, '0')}`);
    assert.equal(vocab.getDailyRecommendState(level).exhausted, true);
    assert.deepEqual(vocab.getDailyRecommendations(level), []);
    assert.equal(vocab.getSeenVocabIds()[level].length, batches * 10);
    assert.equal(vocab.getDailyRecommendState(level).exhausted, true);
  }
});

test('an interrupted batch excludes handled words tomorrow without marking unseen cards as learned', () => {
  browser(); day('2026-11-01');
  const words = vocab.getDailyRecommendations('L3');
  vocab.markDailyHandled(words[0].id, 'passed', 'L3');
  vocab.markDailyHandled(words[1].id, 'added', 'L3');
  day('2026-11-02');
  assert.ok(vocab.getDailyRecommendations('L3').every(word => ![words[0].id, words[1].id].includes(word.id)));
  assert.equal(vocab.getSeenVocabIds().L3.length, 2);
  assert.equal(vocab.getDailyRecommendState('L3').currentIndex, 0);
});

test('legacy positional batches migrate without losing current progress or past-day exclusions', () => {
  const {values} = browser(); day('2026-11-06');
  const legacyIds = Array.from({length: 10}, (_,index) => `daily-2026-11-06-L1-${index}`);
  values.set('english-coach.vocab.daily-recommend.v1', JSON.stringify({
    date: '2026-11-06', level: 'L1', wordIds: legacyIds, currentIndex: 2,
    handled: {[legacyIds[0]]: 'passed', [legacyIds[1]]: 'added'},
  }));
  const state = vocab.getDailyRecommendState('L1');
  assert.equal(state.currentIndex, 2);
  assert.deepEqual(vocab.getDailyRecommendations('L1').slice(0,2).map(word => word.word), ['arrive', 'delicious']);
  assert.equal(vocab.getSeenVocabIds().L1.length, 2);
  assert.ok(state.wordIds.every(id => !id.includes('2026-11-06')));
  day('2026-11-07');
  assert.ok(vocab.getDailyRecommendations('L1').every(word => !state.wordIds.slice(0,2).includes(word.id)));

  const oldIds = Array.from({length: 10}, (_,index) => `daily-2026-11-01-L2-${index}`);
  values.set('english-coach.vocab.daily-recommend.v1.L2', JSON.stringify({date: '2026-11-01', level:'L2', wordIds:oldIds, handled:{[oldIds[0]]:'passed'}, currentIndex:1}));
  assert.ok(vocab.getDailyRecommendations('L2').every(word => word.word !== 'available'));
});

test('corrupt histories and batches recover; an empty pool is persisted as a valid completed state', () => {
  const {values} = browser(); day('2026-11-06');
  values.set('seen_vocab_ids', '{broken');
  values.set('english-coach.vocab.daily-recommend.v1.L1', JSON.stringify({date:'2026-11-06',level:'L1',wordIds:Array(10).fill('bad')}));
  assert.equal(vocab.getDailyRecommendations('L1').length,10);
  const pool = vocab.getDailyWordPool('L5');
  values.set('seen_vocab_ids', JSON.stringify({L5:[...pool.map(word=>word.id),pool[0].id, false, 'foreign']}));
  const state = vocab.getDailyRecommendState('L5');
  assert.equal(state.exhausted,true);
  assert.deepEqual(vocab.getDailyRecommendState('L5'),state);
  assert.equal(vocab.getSeenVocabIds().L5.length,pool.length);
});

test('denied localStorage does not crash page initialization or silently claim persistence', () => {
  browser();
  window.localStorage.getItem = () => {throw new Error('denied');};
  window.localStorage.setItem = () => {throw new Error('denied');};
  const words = vocab.getDailyRecommendations('L1');
  assert.deepEqual(vocab.getDailyRecommendations('L1'),words);
  assert.throws(()=>vocab.markDailyHandled(words[0].id,'passed','L1'), /无法保存学习进度/);
  assert.equal(vocab.getDailyRecommendState('L1').currentIndex,1);
});
