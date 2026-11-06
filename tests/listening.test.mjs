import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const storage = await loadTs(new URL('../src/lib/listening-storage.ts', import.meta.url));
const { generateListeningArticle } = await loadTs(new URL('../src/lib/listening-api.ts', import.meta.url));
const sample = level => ({ titleEn: 'A Quiet Day', titleZh: '安静的一天', category: '日常', level, sentences: Array.from({ length: 12 }, () => ({ en: 'I walk to the park and see a small bird.', zh: '我走到公园，看到一只小鸟。' })) });

test('listening seeds cover every level; schema rejects broken or wrong-level passages', () => {
  assert.deepEqual(storage.getCustomListeningArticles(), []);
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5']) {
    const articles = storage.getListeningArticles(level);
    assert.ok(articles.length >= 1);
    for (const article of articles) {
      assert.equal(storage.parseListeningArticle(article, level).level, level);
      assert.ok(article.sentences.every(item => item.en && item.zh));
      assert.match(article.duration, /^\d+:\d{2}$/);
    }
  }
  assert.throws(() => storage.parseListeningArticle(sample('L1'), 'L5'), /等级/);
  assert.throws(() => storage.parseListeningArticle({ ...sample('L1'), sentences: [] }), /6–14/);
  assert.throws(() => storage.parseListeningArticle({ ...sample('L1'), sentences: Array(7).fill({ en: '', zh: '中文' }) }), /缺少英文/);
  assert.equal(storage.estimateDuration([{ en: Array(85).fill('hello').join(' ') }]), '1:00');
});

test('custom articles persist, deduplicate, recover corrupt entries and respect level filtering', () => {
  const oldWindow = global.window;
  const values = new Map();
  let events = 0;
  global.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, dispatchEvent: event => { assert.equal(event.type, storage.LISTEN_UPDATED_EVENT); events++; } };
  try {
    const item = storage.parseListeningArticle({ ...sample('L2'), id: 'custom-1' });
    storage.saveListeningArticle(item);
    storage.saveListeningArticle({ ...item, titleZh: '更新标题' });
    assert.equal(events, 2);
    assert.equal(JSON.parse(values.get('custom_listen_articles')).length, 1);
    assert.equal(storage.getListeningArticles('L2')[0].titleZh, '更新标题');
    assert.ok(!storage.getListeningArticles('L1').some(item => item.id === 'custom-1'));
    values.set(storage.LISTEN_STORAGE_KEY, JSON.stringify([{}, item, item]));
    assert.equal(storage.getCustomListeningArticles().length, 1);
    values.set(storage.LISTEN_STORAGE_KEY, 'corrupt');
    assert.deepEqual(storage.getCustomListeningArticles(), []);
    global.window.localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => storage.saveListeningArticle(item), /保存失败/);
  } finally { if (oldWindow === undefined) delete global.window; else global.window = oldWindow; }
});

test('generation validates config and schema, forwards level constraints, handles provider errors without a live call', async () => {
  const envKeys = ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'];
  const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const oldFetch = global.fetch;
  const req = body => new Request('http://localhost/api/listen', { method: 'POST', body: JSON.stringify(body) });
  try {
    assert.equal((await generateListeningArticle(req({ level: 'L9' }))).status, 400);
    assert.equal((await generateListeningArticle(req({ level: 'L1', topic: 'x'.repeat(161) }))).status, 400);
    delete process.env.AI_API_KEY;
    assert.equal((await generateListeningArticle(req({ level: 'L1' }))).status, 503);
    Object.assign(process.env, { AI_API_KEY: 'test-only', AI_BASE_URL: 'https://model.example/v1/', AI_MODEL: 'test-model' });
    let result = sample('L1');
    let captured;
    global.fetch = async (url, init) => {
      captured = { url, body: JSON.parse(init.body) };
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }] });
    };
    let response = await generateListeningArticle(req({ level: 'L1', topic: 'morning coffee' }));
    assert.equal(response.status, 200);
    const { article } = await response.json();
    assert.equal(article.level, 'L1');
    assert.equal(article.sentences.length, 12);
    assert.equal(article.audioSpeed, 0.8);
    assert.equal(article.isCustom, true);
    assert.match(captured.body.messages[0].content, /110-150/);
    assert.match(captured.body.messages[0].content, /10-14/);
    assert.equal(captured.url, 'https://model.example/v1/chat/completions');
    assert.match(captured.body.messages[0].content, /500/);
    assert.match(captured.body.messages[1].content, /morning coffee/);
    result = { ...sample('L1'), sentences: sample('L1').sentences.slice(0, 10) };
    assert.equal((await generateListeningArticle(req({ level: 'L1' }))).status, 502);
    result = sample('L5');
    assert.equal((await generateListeningArticle(req({ level: 'L1' }))).status, 502);
    global.fetch = async () => new Response('provider details', { status: 429 });
    response = await generateListeningArticle(req({ level: 'L3' }));
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('provider details'));
    global.fetch = async () => { throw new Error('offline'); };
    assert.equal((await generateListeningArticle(req({ level: 'L3' }))).status, 502);
  } finally {
    global.fetch = oldFetch;
    for (const key of envKeys) { if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key]; }
  }
});


test('generated article length boundaries are enforced without rejecting legacy saved passages', () => {
  const fixture = (sentences, words) => ({ ...sample('L3'), sentences: Array.from({ length: sentences }, (_, index) => ({ en: Array(Math.floor(words / sentences) + (index < words % sentences ? 1 : 0)).fill('word').join(' ') + '.', zh: '对应翻译。' })) });
  for (const [sentences, words] of [[10, 110], [14, 150]]) {
    const article = storage.parseGeneratedListeningArticle(fixture(sentences, words), 'L3');
    assert.equal(storage.countListeningWords(article.sentences), words);
    assert.equal(article.isCustom, true);
  }
  for (const [sentences, words] of [[10, 109], [14, 151], [9, 120], [15, 120]]) {
    assert.throws(() => storage.parseGeneratedListeningArticle(fixture(sentences, words), 'L3'));
  }
  assert.equal(storage.parseListeningArticle(fixture(8, 80), 'L3').sentences.length, 8);
  assert.equal(storage.estimateDuration([{ en: Array(110).fill('word').join(' ') }]), '1:18');
  assert.equal(storage.estimateDuration([{ en: Array(150).fill('word').join(' ') }]), '1:46');
  assert.equal(storage.countListeningWords([{ en: "Don't worry about this well-known place." }]), 6);
});

test('legacy custom articles are removable, dates determine merged order and failed deletion preserves storage', () => {
  const oldWindow = global.window;
  const values = new Map();
  let events = 0;
  global.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, dispatchEvent: () => { events++; } };
  try {
    const preset = storage.getListeningArticles('L1')[0];
    const old = { ...sample('L1'), id: 'old-custom', createdAt: '2000-01-01T00:00:00.000Z' };
    const recent = { ...sample('L1'), id: 'recent-custom', createdAt: '2099-01-01T00:00:00.000Z' };
    values.set(storage.LISTEN_STORAGE_KEY, JSON.stringify([old, recent]));
    let list = storage.getListeningArticles('L1');
    assert.equal(list[0].id, recent.id);
    assert.equal(list.at(-1).id, old.id);
    assert.equal(list.find(item => item.id === preset.id).isCustom, false);
    assert.equal(list.find(item => item.id === old.id).isCustom, true);
    storage.deleteListeningArticle(preset.id);
    assert.equal(events, 1);
    assert.ok(!storage.getListeningArticles('L1').some(item => item.id === preset.id));
    storage.deleteListeningArticle(recent.id);
    assert.equal(events, 2);
    assert.ok(!storage.getListeningArticles('L1').some(item => item.id === recent.id));
    assert.equal(JSON.parse(values.get(storage.LISTEN_STORAGE_KEY)).length, 1);
    const snapshot = values.get(storage.LISTEN_STORAGE_KEY);
    global.window.localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => storage.deleteListeningArticle(old.id), /删除保存失败/);
    assert.equal(values.get(storage.LISTEN_STORAGE_KEY), snapshot);
    assert.equal(storage.getCustomListeningArticles()[0].id, old.id);
  } finally { if (oldWindow === undefined) delete global.window; else global.window = oldWindow; }
});
