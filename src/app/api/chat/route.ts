import { NextResponse } from 'next/server';
import { feedbackPrompt } from '@/lib/feedback';

const defaultPrompt = 'You are a patient, friendly English speaking coach. Keep replies concise and conversational. Ask one short open-ended question to keep the learner speaking. Put all grammar feedback in the separate feedback block.';

export async function POST(request: Request) {
  const key = process.env.AI_API_KEY;
  if (!key) return NextResponse.json({ error: 'AI_API_KEY is not configured' }, { status: 503 });
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = (typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt : defaultPrompt) + '\n' + feedbackPrompt;
    const baseUrl = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
    const model = process.env.AI_MODEL || 'deepseek-chat';
    const url = `${baseUrl}/chat/completions`;
    console.log('[Chat API] 正在请求大模型...');
    console.log(`[Chat API] 目标 URL 与模型：${url} / ${model}`);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: prompt }, ...messages.map((item: { role: string; content: string }) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content).slice(0, 4000) }))], temperature: 0.7, max_tokens: 700 }) });
    if (!response.ok) { const body = await response.text(); console.error(`[Chat API] 请求失败 status=${response.status} body=${body}`); return NextResponse.json({ error: `AI provider request failed (${response.status})` }, { status: 502 }); }
    if (!response.body) return NextResponse.json({ error: 'AI returned no stream' }, { status: 502 });
    console.log('[Chat API] 已连接，开始流式传输');
    const reader = response.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await reader.read();
          if (done) { console.log('[Chat API] 流式传输结束'); controller.close(); reader.releaseLock(); }
          else controller.enqueue(value);
        } catch (error) { console.error('[Chat API] 流式读取失败:', error); controller.error(error); reader.releaseLock(); }
      },
      async cancel(reason) { await reader.cancel(reason); reader.releaseLock(); },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch (error) { console.error('[Chat API] catch 错误对象:', error); console.error('[Chat API] 错误堆栈:', error instanceof Error ? error.stack : undefined); return NextResponse.json({ error: 'Unable to reach AI provider' }, { status: 502 }); }
}
