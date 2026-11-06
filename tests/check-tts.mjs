// Optional integration check: uses the running server and makes one paid OpenAI TTS request.
import https from 'node:https';
import http from 'node:http';
const base = process.env.TTS_TEST_URL || 'http://localhost:3000';
function call(path, data) {
  const url = new URL(path, base);
  return new Promise((resolve, reject) => {
    const body = data === undefined ? undefined : JSON.stringify(data);
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method: body ? 'POST' : 'GET', rejectUnauthorized: false,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks) }));
    });
    req.setTimeout(45000, () => req.destroy(new Error('Test timed out')));
    req.on('error', reject); req.end(body);
  });
}
for (const path of ['/teacher', '/listen']) {
  const page = await call(path);
  console.log(path, page.status);
  if (page.status !== 200) throw new Error(`Page compilation failed: ${path}`);
}
const result = await call('/api/tts', { text: 'Hello, how are you?', speed: 0.9 });
const mp3 = result.body.subarray(0, 3).toString() === 'ID3' || (result.body[0] === 0xff && (result.body[1] & 0xe0) === 0xe0);
console.log('OpenAI tts-1 / nova / 0.9x', { status: result.status, type: result.type, bytes: result.body.length, mp3 });
if (result.status !== 200 || result.type !== 'audio/mpeg' || !mp3) {
  console.error(result.body.toString().slice(0, 1000)); process.exitCode = 1;
}
