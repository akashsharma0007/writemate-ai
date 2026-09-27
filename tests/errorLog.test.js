import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// errorLog.js resolves its data directory from WRITEMATE_DATA_DIR at call
// time (not at import time, unlike store.js), so pointing it at a fresh
// temp folder before each test keeps this isolated from any real data/
// folder and from other test files.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'writemate-errorlog-'));
process.env.WRITEMATE_DATA_DIR = tmpDir;

const { recordError, getRecentErrors, getErrorById, clearErrorLog } = await import('../server/lib/errorLog.js');
const { ErrorCodes } = await import('../server/lib/errorCodes.js');

test('recordError writes an entry and returns an id that getErrorById can find', () => {
  const id = recordError(ErrorCodes.AI_UNAVAILABLE, { httpStatus: 502, provider: 'openai', technicalMessage: 'boom' });
  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);

  const entry = getErrorById(id);
  assert.ok(entry);
  assert.equal(entry.code, 'WM-1004');
  assert.equal(entry.provider, 'openai');
  assert.equal(entry.technicalMessage, 'boom');
  assert.equal(typeof entry.timestamp, 'string');
});

test('getErrorById returns null for an unknown id', () => {
  assert.equal(getErrorById('does-not-exist'), null);
});

test('getRecentErrors returns newest first and respects the limit', () => {
  clearErrorLog();
  recordError(ErrorCodes.AI_NETWORK_ERROR, { technicalMessage: 'first' });
  recordError(ErrorCodes.AI_NETWORK_ERROR, { technicalMessage: 'second' });
  recordError(ErrorCodes.AI_NETWORK_ERROR, { technicalMessage: 'third' });

  const all = getRecentErrors(50);
  assert.equal(all.length, 3);
  assert.equal(all[0].technicalMessage, 'third'); // most recent first

  const limited = getRecentErrors(2);
  assert.equal(limited.length, 2);
});

test('clearErrorLog empties the log', () => {
  recordError(ErrorCodes.UNEXPECTED_SERVER_ERROR, {});
  clearErrorLog();
  assert.deepEqual(getRecentErrors(50), []);
});

test('recorded entries never contain a "text" or "context" or "apiKey" field', () => {
  clearErrorLog();
  const id = recordError(ErrorCodes.AI_AUTH_FAILED, {
    httpStatus: 502,
    provider: 'anthropic',
    action: 'improve',
    textLength: 42, // lengths are fine — never the text itself
    technicalMessage: 'Anthropic API error (401): {"error":"invalid x-api-key"}',
  });
  const entry = getErrorById(id);
  assert.equal('text' in entry, false);
  assert.equal('context' in entry, false);
  assert.equal('apiKey' in entry, false);
});
