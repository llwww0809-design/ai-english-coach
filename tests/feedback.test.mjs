import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';
const { FeedbackStream, parseFeedback } = await loadTs(new URL('../src/lib/feedback.ts', import.meta.url));
const { requestAiReply } = await loadTs(new URL('../src/lib/ai-client.ts', import.meta.url));
const { loadChat, saveChat } = await loadTs(new URL('../src/lib/chat-storage.ts', import.meta.url));
const feedback = { status: 'improve', correction: 'I went shopping yesterday.', suggestion: 'I did some shopping yesterday.', explanation: 'yesterday 表示过去，应使用 went。' };
test('all token boundaries hide tags and JSON while preserving English deltas', () => {
  const raw = `That sounds fun! What did you buy?\n[FEEDBACK]${JSON.stringify(feedback)}[/FEEDBACK]`;
  for (let split = 0; split <= raw.length; split++) {
    let output = ''; const stream = new FeedbackStream(text => output += text);
    stream.push(raw.slice(0, split)); stream.push(raw.slice(split));
    assert.equal(output.trim(), 'That sounds fun! What did you buy?'); assert.deepEqual(stream.finish(), feedback);
  }
  let output = ''; const stream = new FeedbackStream(text => output += text);
  for (const char of raw) stream.push(char);
  assert.equal(output.trim(), 'That sounds fun! What did you buy?'); assert.deepEqual(stream.finish(), feedback);
});
test('invalid/truncated metadata is hidden without inventing a positive assessment', () => {
  for (const suffix of ['[FEED', '[FEEDBACK]{bad json}[/FEEDBACK]', '[FEEDBACK]{"status":"perfect"}', '[FEEDBACK]{"status":"perfect"}[/FEEDBACK]']) {
    let output = ''; const stream = new FeedbackStream(text => output += text); stream.push(`Hello!${suffix}`);
    assert.equal(output, 'Hello!'); assert.equal(stream.finish(), undefined);
  }
  assert.equal(parseFeedback({ ...feedback, status: 'unknown' }), undefined);
  assert.equal(parseFeedback({ ...feedback, explanation: 123 }), undefined);
  assert.equal(parseFeedback({ status: 'correct', correction: '', suggestion: 'What a lovely day!', explanation: '表达自然。' }).status, 'perfect');
});
test('stream integration sends only conversational text to the bubble/TTS and attaches analysis after completion', async () => {
  const previous = globalThis.fetch;
  try {
    const content = `Hi there! [FEEDBACK]${JSON.stringify(feedback)}[/FEEDBACK]`;
    const events = [...content].map(char => `data: ${JSON.stringify({ choices: [{ delta: { content: char } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
    globalThis.fetch = async () => new Response(events);
    let displayed = ''; let analysis;
    const reply = await requestAiReply([], undefined, text => displayed += text, undefined, value => analysis = value);
    assert.equal(reply, 'Hi there!'); assert.equal(displayed.trim(), reply); assert.deepEqual(analysis, feedback);
  } finally { globalThis.fetch = previous; }
});
test('teacher and scene histories independently persist feedback and load old records', () => {
  const previous = globalThis.localStorage; const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  try {
    const messages = [{ id: 1, role: 'user', content: 'I go shopping yesterday.', feedback }];
    saveChat(messages); saveChat([{ ...messages[0], content: 'One coffee, please.' }], 'cafe');
    assert.deepEqual(loadChat()[0].feedback, feedback); assert.equal(loadChat('cafe')[0].content, 'One coffee, please.'); assert.equal(loadChat('hotel'), null);
    saveChat([{ id: 0, role: 'assistant', content: 'Hello!' }]); assert.equal(loadChat()[0].feedback, undefined);
    saveChat([{ id: 1, role: 'user', content: 'Hello!', feedbackState: 'pending' }]); assert.equal(loadChat()[0].feedbackState, 'unavailable');
  } finally { globalThis.localStorage = previous; }
});
