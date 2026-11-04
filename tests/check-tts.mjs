// Test the running HTTPS development server without invoking the paid chat model.
import https from 'node:https';
import http from 'node:http';
const base = process.env.TTS_TEST_URL || 'https://127.0.0.1:3001';
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
for (const path of ['/teacher', '/scenarios/cafe']) {
  const page = await call(path);
  console.log(path, page.status);
  if (page.status !== 200) throw new Error(`Page compilation failed: ${path}`);
}
const invalid = await call('/api/tts', { text: 'hello', voice: 'invalid' });
if (invalid.status !== 400) throw new Error(`Validation failed: ${invalid.status}`);
console.log('Invalid voice correctly rejected (400).');
for (const voice of ['en-US-JennyNeural', 'en-US-GuyNeural', 'en-GB-SoniaNeural']) {
  const result = voice === 'en-US-JennyNeural'
    ? await call('/api/tts?text=Hello%2C%20how%20are%20you%3F')
    : await call('/api/tts', { text: 'Hello, how are you?', voice });
  const mp3 = result.body.subarray(0, 3).toString() === 'ID3' || (result.body[0] === 0xff && (result.body[1] & 0xe0) === 0xe0);
  console.log(voice, { status: result.status, type: result.type, bytes: result.body.length, mp3 });
  if (result.status !== 200 || result.type !== 'audio/mpeg' || !mp3) {
    console.error(result.body.toString().slice(0, 1000)); process.exitCode = 1;
  }
}
