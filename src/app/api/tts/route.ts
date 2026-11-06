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
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[TTS API] ElevenLabs configuration error', new Error('ELEVENLABS_API_KEY is not configured'));
    return Response.json({ error: '语音服务尚未配置，请设置 ELEVENLABS_API_KEY。' }, { status: 500 });
  }

  const controller = new AbortController();
  const cancel = () => controller.abort(request.signal.reason);
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('ElevenLabs TTS exceeded the 8000ms deadline');
      reject(error); controller.abort(error);
    }, 8000);
  });
  const startedAt = Date.now();
  try {
    console.log('[TTS Upstream Start]:', { provider: 'ElevenLabs', voice: 'Sarah', timeoutMs: 8000 });
    const bytes = await Promise.race([(async () => {
      const speech = await fetch('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: text.trim(), model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: controller.signal,
      });
      console.log('[TTS Upstream Response]:', { status: speech.status, elapsedMs: Date.now() - startedAt });
      if (!speech.ok) throw new Error('ElevenLabs HTTP ' + speech.status + ': ' + await speech.text());
      if (!speech.headers.get('content-type')?.includes('audio/mpeg')) throw new Error('ElevenLabs returned invalid audio content type');
      return speech.arrayBuffer();
    })(), deadline]);
    if (!bytes.byteLength) throw new Error('Empty speech response');
    console.log('[TTS Synthesis Complete]:', { bytes: bytes.byteLength, elapsedMs: Date.now() - startedAt });
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
    console.error('[TTS API] ElevenLabs speech synthesis failed', error);
    return Response.json({ error: '语音合成暂不可用，请稍后重试。' }, { status: 500 });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
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
