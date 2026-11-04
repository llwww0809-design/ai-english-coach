import { FeedbackStream, type ExpressionFeedback } from './feedback';

export async function requestAiReply(messages: { role: 'user' | 'assistant'; content: string }[], prompt?: string, onDelta?: (text: string) => void, signal?: AbortSignal, onFeedback?: (feedback: ExpressionFeedback | undefined) => void) {
  const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, prompt }), signal });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'AI request failed'); }
  if (!response.body) throw new Error('AI returned no stream');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let full = ''; let finished = false;
  const feedbackStream = new FeedbackStream(text => { if (text) { full += text; onDelta?.(text); } });
  function parseFrame(frame: string) {
    const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!payload) return;
    if (payload === '[DONE]') { finished = true; return; }
    const data = JSON.parse(payload);
    if (data.error) throw new Error('AI stream returned an error');
    const text = data?.choices?.[0]?.delta?.content;
    if (typeof text === 'string' && text) feedbackStream.push(text);
    if (data?.choices?.[0]?.finish_reason) finished = true;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) { parseFrame(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
      if (done) { if (buffer.trim()) parseFrame(buffer); break; }
    }
    if (!finished) throw new Error('AI stream interrupted');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!full.trim()) throw new Error('AI returned an empty response');
  onFeedback?.(feedbackStream.finish());
  return full.trim();
}
