import { isLearningLevel } from './level-config';
import { topicDefinitions } from './topic-vocab';
import { parseTopicGeneration, topicGenerationPrompt, wordKey } from './topic-generation';


export async function expandTopicVocabulary(body: Record<string, unknown>, key: string, signal: AbortSignal) {
  const topic = topicDefinitions.find(item => item.id === body.topicId);
  if (!topic || !isLearningLevel(body.level) || !Array.isArray(body.excludeWords) ||
    body.excludeWords.length > 5000 || body.excludeWords.some(word => typeof word !== 'string' || word.length > 120)) {
    return Response.json({ error: '场景、等级或已有词汇参数无效。' }, { status: 400 });
  }
  const level = body.level;
  const excluded = [...new Set([...topic.byLevel[level].map(row => row[0]), ...body.excludeWords as string[]].map(wordKey))];
  const url = (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '') + '/chat/completions';
  const model = process.env.AI_MODEL || 'deepseek-chat';
  try {
    console.log('[Topic API] 正在扩充场景词汇', { topic: topic.id, level, model, url });
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, stream: false, temperature: 0.7, max_tokens: 4000,
        messages: [{ role: 'system', content: 'You create accurate graded English vocabulary datasets. Return valid JSON only.' },
          { role: 'user', content: topicGenerationPrompt(topic.title, level, excluded) }] }),
    });
    if (!response.ok) {
      console.error('[Topic API] 请求失败', response.status, await response.text());
      return Response.json({ error: 'AI 服务请求失败（' + response.status + '），请检查服务额度或稍后重试。' }, { status: 502 });
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || data?.choices?.[0]?.finish_reason === 'length') throw new Error('模型返回不完整，请重试。');
    const words = parseTopicGeneration(content, level, excluded);
    console.log('[Topic API] 成功生成 10 个新词', { topic: topic.id, level });
    return Response.json({ topicId: topic.id, level, words }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Topic API] 生成失败', error);
    return Response.json({ error: error instanceof Error && error.name === 'TimeoutError'
      ? '生成超时，请稍后重试。' : '未能生成完整且无重复的 10 个新词，请重试。原词包保持不变。' }, { status: 502 });
  }
}
