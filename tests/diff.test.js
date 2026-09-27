import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWordDiff } from '../server/lib/diff.js';

test('identical strings produce no added/removed segments', () => {
  const diff = computeWordDiff('hello world', 'hello world');
  assert.ok(diff.every((part) => !part.added && !part.removed));
});

test('detects an added and removed word', () => {
  const diff = computeWordDiff('you have to remove this', 'please deduct this');
  assert.ok(diff.some((p) => p.removed));
  assert.ok(diff.some((p) => p.added));
  // Reconstructing "added or unchanged" segments should give the new text.
  const reconstructed = diff.filter((p) => !p.removed).map((p) => p.value).join('');
  assert.equal(reconstructed, 'please deduct this');
});

test('handles empty strings gracefully', () => {
  const same = computeWordDiff('', '');
  assert.ok(same.every((p) => !p.added && !p.removed));
  const diff = computeWordDiff('', 'new text');
  assert.ok(diff.some((p) => p.added && p.value === 'new text'));
});
