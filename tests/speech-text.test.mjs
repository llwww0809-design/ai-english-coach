import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/speech-text.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { speechText } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('omits emoji, decoration and non-English text while keeping natural punctuation', () => {
  assert.equal(speechText('🌿 **Great work!** 你真棒 👍\nTry: “I’m happy.”'), 'Great work! Try: "I\'m happy."');
});
test('reads link labels but omits URLs, images, and fenced code', () => {
  assert.equal(speechText('Visit [our cafe](https://example.com). ![photo](https://example.com/photo)\n```js\nalert(1);\n```\nEnjoy your coffee!'), 'Visit our cafe. Enjoy your coffee!');
});
test('symbol-only replies produce no speech', () => { assert.equal(speechText('👩‍🏫 🌟 ** 你好'), ''); });
