import OpenAI from 'openai';

export const runtime = 'nodejs';

async function synthesize(request: Request, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return Response.json({ error: '请提供朗读内容。' }, { status: 400 });
  const { text, speed = 0.9 } = input as Record<string, unknown>;
  console.log('[TTS Request Received]:', text);
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
    return Response.json({ error: '朗读内容须为 1–4000 字符。' }, { status: 400 });
  }
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.25 || speed > 4) {
    return Response.json({ error: '语速须为 0.25–4.0 之间的数字。' }, { status: 400 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: '语音服务尚未配置，请设置 OPENAI_API_KEY。' }, { status: 503 });

  try {
    const client = new OpenAI({ apiKey, ...(process.env.OPENAI_BASE_URL?.trim() ? { baseURL: process.env.OPENAI_BASE_URL.trim() } : {}), timeout: 35000, maxRetries: 0 });
    // Always use an official OpenAI voice, including for legacy Jenny callers.
    const speech = await client.audio.speech.create({
      model: 'tts-1', voice: 'nova', input: text.trim(), speed, response_format: 'mp3',
    }, { signal: request.signal });
    const bytes = await speech.arrayBuffer();
    if (!bytes.byteLength) throw new Error('Empty speech response');
    return new Response(bytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
        // Keep spoken user content out of shared/CDN caches. GET responses may be
        // reused by the browser; POST tracks are also cached by the audio player.
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (request.signal.aborted) return Response.json({ error: '语音请求已取消。' }, { status: 499 });
    console.error('[TTS API] OpenAI speech synthesis failed', error);
    return Response.json({ error: '语音合成暂不可用，请稍后重试。' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: '请求内容必须为有效 JSON。' }, { status: 400 }); }
  return synthesize(request, input);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return synthesize(request, { text: params.get('text'), ...(params.has('speed') ? { speed: Number(params.get('speed')) } : {}) });
}
