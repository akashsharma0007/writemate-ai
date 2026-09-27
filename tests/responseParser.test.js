import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelResponse } from '../server/lib/responseParser.js';

test('clean JSON parses with parseIssue: null', () => {
  const raw = JSON.stringify({ correctedText: 'We have completed the testing.', issues: [], warnings: [] });
  const parsed = parseModelResponse(raw, { isGrammar: true });
  assert.equal(parsed.parseIssue, null);
  assert.equal(parsed.correctedText, 'We have completed the testing.');
});

test('truncated-but-recoverable JSON sets parseIssue: "truncated_recovered"', () => {
  // Deliberately cut off mid-object, after the field that matters most —
  // no closing quote/brace, simulating a maxOutputTokens truncation.
  const raw = '{"improvedText": "Hi, just wanted to let you know';
  const result = parseModelResponse(raw, { isGrammar: false });
  assert.equal(result.parseIssue, 'truncated_recovered');
  assert.match(result.improvedText, /just wanted to let you know/);
});

test('unparseable garbage sets parseIssue: "unparseable"', () => {
  const raw = 'the model just said something with no JSON in it at all';
  const result = parseModelResponse(raw, { isGrammar: true });
  assert.equal(result.parseIssue, 'unparseable');
  assert.equal(result.correctedText, raw);
});
