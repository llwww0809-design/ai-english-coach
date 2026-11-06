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
  // Listening mode uses one explicit pace; regular chat retains its level-based rate.
  const options = input as Record<string, unknown>;
  const listening = options.mode === 'listening';
  if (listening && options.speed !== 0.8 && options.speed !== 1) return Response.json({ error: '听读语速仅支持 0.8 或 1.0。' }, { status: 400 });
  const rate = listening ? (options.speed === 0.8 ? '-20%' : '+0%') : learningLevels.find(item => item.id === level)?.ttsRate ?? '+0%';
  const sentences = listening && Array.isArray(options.sentences) && options.sentences.length <= 30 && options.sentences.every(sentence => typeof sentence === 'string' && sentence.trim()) ? options.sentences as string[] : null;
  if (sentences && sentences.join(' ').trim() !== text.trim()) return Response.json({ error: '听读句子与正文不一致。' }, { status: 400 });
  const sentenceTimes: number[] = [];
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
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { sentenceBoundaryEnabled: Boolean(sentences) });
        if (request.signal.aborted) throw new Error('TTS request cancelled');
        const streams = tts.toStream(sentences ? sentences.map(sentence => '<s>' + escapeXml(sentence) + '</s>').join(' ') : escapeXml(text.trim()), { rate });
        audio = streams.audioStream;
        const metadata = streams.metadataStream;
        const chunks: Buffer[] = [];
        // Flowing mode preserves the provider's individual JSON metadata frames.
        metadata?.on('data', chunk => {
          try {
            const data = JSON.parse(String(chunk)) as { Metadata?: { Type?: string; Data?: { Offset?: number } }[] };
            for (const item of data.Metadata || []) {
              if (item.Type === 'SentenceBoundary' && typeof item.Data?.Offset === 'number' && item.Data.Offset >= 0) sentenceTimes.push(item.Data.Offset / 10000000);
            }
          } catch { /* Missing timing metadata must not prevent audio playback. */ }
        });
        for await (const chunk of audio) chunks.push(Buffer.from(chunk));
        const result = Buffer.concat(chunks);
        if (!result.length) throw new Error('Microsoft returned empty audio');
        return result;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { abort(); reject(new Error('TTS request timed out')); }, 35000); }),
    ]);
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(bytes.length), ...(sentences && sentenceTimes.length === sentences.length ? { 'X-Sentence-Times': JSON.stringify(sentenceTimes) } : {}) } });
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
