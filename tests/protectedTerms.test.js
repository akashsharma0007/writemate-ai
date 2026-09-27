import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProtectedTerms, verifyProtectedTerms, DEFAULT_PROTECTED_TERMS } from '../server/lib/protectedTerms.js';

test('extracts a default named term (GA13)', () => {
  const found = extractProtectedTerms('this is about GA13 and the change it introduced');
  assert.ok(found.includes('GA13'));
});

test('extracts URLs, emails, dollar amounts, and dates', () => {
  const text = 'See https://example.com/report, contact a@b.com about the $1,250.00 charge on 2024-05-01.';
  const found = extractProtectedTerms(text);
  assert.ok(found.some((f) => f.includes('https://example.com/report')));
  assert.ok(found.includes('a@b.com'));
  assert.ok(found.some((f) => f.includes('1,250.00')));
  assert.ok(found.some((f) => f.includes('2024-05-01')));
});

test('extracts custom user-added terms case-insensitively but preserves original casing found', () => {
  const found = extractProtectedTerms('Please check orbit before closing the ticket.', ['Orbit']);
  assert.ok(found.includes('orbit'));
});

test('extracts ticket-style IDs and version numbers', () => {
  const found = extractProtectedTerms('Escalated as INC00012345, fixed in v2.3.1, see also TICKET-882.');
  assert.ok(found.some((f) => f.includes('INC00012345')));
  assert.ok(found.some((f) => f.includes('2.3.1')));
  assert.ok(found.some((f) => f.includes('TICKET-882')));
});

test('does not choke on empty input', () => {
  assert.deepEqual(extractProtectedTerms(''), []);
  assert.deepEqual(extractProtectedTerms(null), []);
});

test('verifyProtectedTerms finds nothing missing when everything survived', () => {
  const terms = ['GA13', '$100'];
  const warnings = verifyProtectedTerms(terms, 'Please note GA13 and the $100 fee remain the same.');
  assert.equal(warnings.length, 0);
});

test('verifyProtectedTerms flags a term that disappeared from the rewrite', () => {
  const terms = ['GA13'];
  const warnings = verifyProtectedTerms(terms, 'Please note the calculation change remains the same.');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /GA13/);
});

test('default protected terms include the examples from the spec', () => {
  for (const term of ['GA13', 'GA14', 'Orbit', 'SLA', 'Tier-2', 'CDB_CUSTOMER_INFO']) {
    assert.ok(DEFAULT_PROTECTED_TERMS.includes(term), `expected ${term} in defaults`);
  }
});
