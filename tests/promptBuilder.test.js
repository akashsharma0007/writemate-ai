import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, TONES, ACTIONS } from '../server/lib/promptBuilder.js';

test('builds a rewrite prompt including tone, context, protected terms, and writing style', () => {
  const { systemPrompt, userPrompt } = buildPrompt({
    text: 'you have to remove abandoned sales from gross sales plus taxes',
    context: 'Customer confused about GA13 reporting change',
    tone: 'Professional',
    action: 'professional',
    writingStyle: ["Don't overuse 'please'"],
    protectedTerms: ['GA13'],
  });

  assert.match(systemPrompt, /TARGET TONE: Professional/);
  assert.match(systemPrompt, /PROTECTED VALUES/);
  assert.match(systemPrompt, /GA13/);
  assert.match(systemPrompt, /Don't overuse 'please'/);
  assert.match(systemPrompt, /workplace-appropriate/); // professional action instruction
  assert.match(systemPrompt, /single valid JSON object/);
  assert.match(userPrompt, /Context:/);
  assert.match(userPrompt, /Original text:/);
  assert.match(userPrompt, /abandoned sales/);
});

test('grammar action requests the grammar JSON schema, not the rewrite schema', () => {
  const { systemPrompt } = buildPrompt({ text: 'we has completed the testing', action: 'fix_grammar' });
  assert.match(systemPrompt, /correctedText/);
  assert.match(systemPrompt, /"issues"/);
  assert.doesNotMatch(systemPrompt, /"improvedText"/);
});

test('custom action includes the custom instruction as the primary directive', () => {
  const { systemPrompt } = buildPrompt({
    text: 'hey can you check this',
    action: 'custom',
    customInstruction: 'Sound professional but not robotic.',
  });
  assert.match(systemPrompt, /CUSTOM INSTRUCTION FROM USER/);
  assert.match(systemPrompt, /Sound professional but not robotic\./);
});

test('omits context section entirely when no context given', () => {
  const { userPrompt } = buildPrompt({ text: 'hello', action: 'improve' });
  assert.doesNotMatch(userPrompt, /Context:/);
});

test('every action referenced by the app has an instruction defined', () => {
  for (const action of Object.keys(ACTIONS)) {
    assert.ok(ACTIONS[action] && ACTIONS[action].length > 0, `missing instruction for ${action}`);
  }
});

test('TONES list matches the tones named in the spec', () => {
  for (const tone of ['Professional', 'Friendly', 'Formal', 'Casual', 'Confident', 'Diplomatic', 'Concise', 'Empathetic', 'Direct', 'Technical', 'Customer-Friendly', 'Executive', 'Neutral']) {
    assert.ok(TONES.includes(tone), `expected tone ${tone}`);
  }
});
