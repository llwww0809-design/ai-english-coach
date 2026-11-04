import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const { requestAiReply } = await loadTs(new URL('../src/lib/ai-client.ts', import.meta.url));
const originalFetch = globalThis.fetch;
function mockStream(text) {
  const bytes = new TextEncoder().encode(text);
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
}
test('SSE handles split UTF-8, CRLF, multiple frames, and emits before completion', async () => {
  try {
    mockStream(': heartbeat\r\n\r\ndata: {"choices":[{"delta":{"content":"Hi 你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    const deltas = [];
    assert.equal(await requestAiReply([], undefined, text => deltas.push(text)), 'Hi 你好!');
    assert.deepEqual(deltas, ['Hi 你好', '!']);
  } finally { globalThis.fetch = originalFetch; }
});
test('retains partial deltas but rejects an interrupted stream', async () => {
  try { mockStream('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'); const deltas = []; await assert.rejects(requestAiReply([], undefined, text => deltas.push(text)), /interrupted/); assert.deepEqual(deltas, ['Partial']); }
  finally { globalThis.fetch = originalFetch; }
});
test('reports HTTP and provider SSE errors', async () => {
  try { globalThis.fetch = async () => Response.json({error:'AI_API_KEY is not configured'}, {status:503}); await assert.rejects(requestAiReply([]), /not configured/); mockStream('data: {"error":{"message":"provider failure"}}\n\n'); await assert.rejects(requestAiReply([]), /stream returned an error/); }
  finally { globalThis.fetch = originalFetch; }
});
