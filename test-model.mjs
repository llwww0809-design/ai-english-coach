import fs from 'node:fs';

function loadEnv() {
  const file = '.env.local';
  if (!fs.existsSync(file)) throw new Error(`找不到 ${file}，请先从 .env.local.example 创建并填写配置。`);
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !match[1].startsWith('#')) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = loadEnv();
const key = env.AI_API_KEY;
const base = (env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const model = env.AI_MODEL || 'deepseek-chat';
const url = `${base}/chat/completions`;
if (!key || key === 'your_api_key_here') throw new Error('AI_API_KEY 未配置或仍是示例值。');

console.log('[API Test] 请求 URL:', url);
console.log('[API Test] 模型:', model);
console.log('[API Test] 正在发送 ping 请求...');
try {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 20 }) });
  const body = await response.text();
  console.log('[API Test] HTTP 状态码:', response.status);
  console.log('[API Test] 原始响应 Body:', body);
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error('[API Test] 请求异常:', error);
  console.error('[API Test] 错误堆栈:', error?.stack);
  process.exitCode = 1;
}
