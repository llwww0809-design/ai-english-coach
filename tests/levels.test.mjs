import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './load-ts.mjs';

const levels = await loadTs(new URL('../src/lib/levels.ts', import.meta.url));

test('defines five CEFR levels, L3 default, and the requested speech rates', () => {
  assert.deepEqual(levels.learningLevels.map(level => [level.id, level.cefr, level.ttsRate]), [
    ['L1', 'A1', '-20%'],
    ['L2', 'A2', '-10%'],
    ['L3', 'B1', '+0%'],
    ['L4', 'B2', '+5%'],
    ['L5', 'C1', '+10%'],
  ]);
  assert.equal(levels.DEFAULT_LEVEL, 'L3');
});

test('normalizes saved three-level choices and selects the right coaching prompt', () => {
  assert.equal(levels.normalizeLearningLevel('A1'), 'L1');
  assert.equal(levels.normalizeLearningLevel('A2'), 'L2');
  assert.equal(levels.normalizeLearningLevel('B1'), 'L3');
  assert.equal(levels.normalizeLearningLevel('unknown'), 'L3');
  assert.match(levels.getLevelPrompt('L1'), /500 most basic/);
  assert.match(levels.getLevelPrompt('L5'), /idioms, metaphors/);
});
