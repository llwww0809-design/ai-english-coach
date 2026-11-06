import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
test('OpenAI TTS: defaults, MP3, GET speed, validation and safe errors', async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const calls = [];
  const originalError = console.error;
  globalThis.__ttsTest = { calls, fail: false };
  const sdk = dataUrl(`export default class OpenAI {
    static APIError = class extends Error {};
    constructor(options) { this.audio = { speech: { create: async (body, opts) => {
      globalThis.__ttsTest.calls.push({options, body, opts});
      if (globalThis.__ttsTest.fail) throw new Error('private upstream details');
      return new Response(new Uint8Array([73,68,51,1,2]));
    } } }; }
  }`);
  let js = ts.transpileModule(readFileSync(new URL('../src/app/api/tts/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/from ['"]openai['"]/, "from '" + sdk + "'");
  const { POST, GET } = await import(dataUrl(js));
  const post = body => POST(new Request('http://localhost/api/tts', { method: 'POST', body: JSON.stringify(body) }));
  try {
    process.env.OPENAI_API_KEY = 'test-only';
    let response = await post({text:' Hello! ', voice:'en-US-JennyNeural'});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(response.headers.get('Cache-Control'), 'private, max-age=86400');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [73,68,51,1,2]);
    assert.deepEqual(calls[0].body, { model:'tts-1', voice:'nova', input:'Hello!', speed:0.9, response_format:'mp3' });
    assert.equal(calls[0].options.maxRetries, 0);
    assert.ok(calls[0].opts.signal instanceof AbortSignal);
    response = await GET(new Request('http://localhost/api/tts?text=Hello&speed=0.8'));
    assert.equal(response.status, 200); assert.equal(calls.at(-1).body.speed, 0.8);
    for (const speed of [0, 4.1, '0.8', null]) assert.equal((await post({text:'Hello', speed})).status, 400);
    assert.equal((await post({text:''})).status, 400);
    assert.equal((await post({text:'a'.repeat(4001)})).status, 400);
    assert.equal((await POST(new Request('http://localhost/api/tts', {method:'POST',body:'{'}))).status, 400);
    delete process.env.OPENAI_API_KEY;
    const count = calls.length;
    assert.equal((await post({text:'Hello'})).status, 503); assert.equal(calls.length, count);
    process.env.OPENAI_API_KEY = 'test-only'; console.error = () => {};
    globalThis.__ttsTest.fail = true;
    response = await post({text:'Hello'});
    assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('private upstream'));
  } finally {
    console.error = originalError;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    delete globalThis.__ttsTest;
  }
});
