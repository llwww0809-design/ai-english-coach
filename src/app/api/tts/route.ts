export const runtime = 'nodejs';
export const maxDuration = 60;

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
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); };
  const timed = <T,>(operation: Promise<T>): Promise<T> => Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('ElevenLabs TTS exceeded the 8000ms deadline');
        controller.abort(error); reject(error);
      }, 8000);
    }),
  ]).finally(() => clearTimeout(timer));
  try {
    const speech = await timed(fetch('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream?output_format=mp3_22050_32&optimize_streaming_latency=4', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.trim(), model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: controller.signal,
    }));
    console.log('[TTS Upstream Response]:', { status: speech.status, streaming: true });
    if (!speech.ok) throw new Error('ElevenLabs HTTP ' + speech.status + ': ' + await timed(speech.text()));
    if (!speech.headers.get('content-type')?.includes('audio/mpeg') || !speech.body) throw new Error('ElevenLabs returned invalid audio content');
    const reader = speech.body.getReader();
    // Pull one chunk at a time: preserve backpressure without buffering the MP3.
    const stream = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          const { value, done } = await timed(reader.read());
          if (done) { cleanup(); reader.releaseLock(); output.close(); }
          else output.enqueue(value);
        } catch (error) {
          console.error('[TTS API] Audio stream interrupted', error);
          controller.abort(error); cleanup();
          await reader.cancel(error).catch(() => {}); output.error(error);
        }
      },
      async cancel(reason) {
        controller.abort(reason); cleanup(); await reader.cancel(reason).catch(() => {});
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    controller.abort(error); cleanup();
    console.error('[TTS API] ElevenLabs speech synthesis failed', error);
    return Response.json({ error: '语音合成暂不可用，请稍后重试。' }, { status: 500 });
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
