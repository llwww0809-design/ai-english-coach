export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length')) > 4 * 1024 * 1024) return Response.json({ error: '录音过长，请控制在一分钟内。' }, { status: 413 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024 || !/^(audio\/|video\/mp4)/.test(file.type)) return Response.json({ error: '请上传有效录音（最大 4 MB）。' }, { status: 400 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return Response.json({ error: '语音识别暂未配置，请使用文字输入。' }, { status: 503 });
    const body = new FormData();
    body.set('file', file); body.set('model', 'whisper-1'); body.set('language', 'en');
    const base = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(base + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body, signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) throw new Error('STT upstream HTTP ' + response.status + ': ' + await response.text());
    const result = await response.json();
    if (typeof result.text !== 'string' || !result.text.trim()) return Response.json({ error: '没有听清，请再说一次。' }, { status: 422 });
    return Response.json({ text: result.text.trim().slice(0, 2000) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[STT API] Transcription failed', error);
    return Response.json({ error: '语音识别暂不可用，请重试或使用文字输入。' }, { status: 500 });
  }
}
