import test from 'node:test';
import assert from 'node:assert/strict';
import { ErrorCodes, classifyProviderError } from '../server/lib/errorCodes.js';

test('every ErrorCodes entry has a unique code, an httpStatus, and a message()', () => {
  const seen = new Set();
  for (const [key, entry] of Object.entries(ErrorCodes)) {
    assert.match(entry.code, /^WM-\d+$/, `${key} should have a WM-#### code`);
    assert.ok(!seen.has(entry.code), `${key}'s code ${entry.code} is duplicated`);
    seen.add(entry.code);
    assert.equal(typeof entry.httpStatus, 'number');
    assert.equal(typeof entry.message(), 'string');
    assert.ok(entry.message().length > 0);
  }
});

test('classifyProviderError maps a 401/403 to AI_AUTH_FAILED', () => {
  assert.equal(classifyProviderError({ status: 401, message: 'nope' }), ErrorCodes.AI_AUTH_FAILED);
  assert.equal(classifyProviderError({ status: 403, message: 'nope' }), ErrorCodes.AI_AUTH_FAILED);
});

test('classifyProviderError maps a 429 to AI_RATE_LIMITED', () => {
  assert.equal(classifyProviderError({ status: 429, message: 'slow down' }), ErrorCodes.AI_RATE_LIMITED);
});

test('classifyProviderError maps any 5xx to AI_UNAVAILABLE', () => {
  assert.equal(classifyProviderError({ status: 503, message: 'UNAVAILABLE' }), ErrorCodes.AI_UNAVAILABLE);
  assert.equal(classifyProviderError({ status: 500, message: 'boom' }), ErrorCodes.AI_UNAVAILABLE);
});

test('classifyProviderError maps a timeout (no status) to AI_NETWORK_ERROR', () => {
  const err = new Error('Request to AI provider timed out after 30000ms');
  assert.equal(classifyProviderError(err), ErrorCodes.AI_NETWORK_ERROR);
});

test('classifyProviderError maps a plain fetch/network failure to AI_NETWORK_ERROR', () => {
  assert.equal(classifyProviderError(new Error('fetch failed')), ErrorCodes.AI_NETWORK_ERROR);
  assert.equal(classifyProviderError(new Error('getaddrinfo ENOTFOUND api.example.com')), ErrorCodes.AI_NETWORK_ERROR);
});

test('classifyProviderError falls back to UNEXPECTED_SERVER_ERROR for anything unrecognized', () => {
  assert.equal(classifyProviderError(new Error('something else entirely')), ErrorCodes.UNEXPECTED_SERVER_ERROR);
});

test('AI_NOT_CONFIGURED and INPUT_TOO_LONG interpolate their detail into the message', () => {
  assert.match(ErrorCodes.AI_NOT_CONFIGURED.message({ provider: 'openai' }), /openai/);
  assert.match(ErrorCodes.INPUT_TOO_LONG.message({ max: 8000 }), /8000/);
});
