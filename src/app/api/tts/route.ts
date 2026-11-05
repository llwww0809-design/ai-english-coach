import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { defaultVoice } from '@/lib/tts-voices';
import { DEFAULT_LEVEL, isLearningLevel, learningLevels } from '@/lib/level-config';

export const runtime = 'nodejs';

const escapeXml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

async function synthesize(request: Request, input: unknown) {
  if (!input || typeof input !== 'object') return Response.json({ error: '请提供朗读内容。' }, { status: 400 });
  const { text } = input as Record<string, unknown>;
  const level = isLearningLevel((input as Record<string, unknown>).level) ? (input as Record<string, unknown>).level : DEFAULT_LEVEL;
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) {
    return Response.json({ error: '朗读内容须为 1–4000 字符。' }, { status: 400 });
  }
  const voice = defaultVoice;
  const rate = learningLevels.find(item => item.id === level)?.ttsRate ?? '+0%';
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 20000 });
  let audio: ReturnType<MsEdgeTTS['toStream']>['audioStream'] | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => { audio?.destroy(new Error('TTS request cancelled')); tts.close(); };
  request.signal.addEventListener('abort', abort, { once: true });
  try {
    if (request.signal.aborted) throw new Error('TTS request cancelled');
    // Bound the entire request as well as the library's connection/idle deadlines.
    const bytes = await Promise.race([
      (async () => {
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
        if (request.signal.aborted) throw new Error('TTS request cancelled');
        audio = tts.toStream(escapeXml(text.trim()), { rate }).audioStream;
        const chunks: Buffer[] = [];
        for await (const chunk of audio) chunks.push(Buffer.from(chunk));
        const result = Buffer.concat(chunks);
        if (!result.length) throw new Error('Microsoft returned empty audio');
        return result;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { abort(); reject(new Error('TTS request timed out')); }, 35000); }),
    ]);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(bytes.length) } });
  } catch (error) {
    console.error('[TTS API] Microsoft speech synthesis failed:', error);
    return Response.json({ error: '微软语音暂时无法连接，请稍后重试。' }, { status: 502 });
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    audio?.destroy();
    tts.close();
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
  return synthesize(request, { text: params.get('text'), level: params.get('level') });
}
