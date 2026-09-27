/**
 * Protected-term system (brief section 28).
 *
 * Two layers of defense, because an LLM instruction alone is not a
 * guarantee:
 *   1. EXTRACT — find every value in the original text that must survive
 *      untouched, and hand that explicit list to the model as part of the
 *      prompt (see promptBuilder.js).
 *   2. VERIFY — after the model responds, check that every extracted value
 *      still appears verbatim in the rewritten text. Anything missing is
 *      surfaced to the user as a warning, never silently accepted.
 *
 * This is a best-effort safety net, not a cryptographic guarantee — it is
 * documented as such in PRIVACY.md / README.md.
 */

// Terms the brief calls out by name as an example default set.
export const DEFAULT_PROTECTED_TERMS = [
  'GA13',
  'GA14',
  'DIN/DASH',
  'Orbit',
  'Zoho Desk',
  'SFTP',
  'NOC',
  'SLA',
  'PS',
  'Tier-2',
  'CDB_CUSTOMER_INFO',
];

const PATTERNS = [
  { label: 'url', regex: /\bhttps?:\/\/[^\s<>"')]+/gi },
  { label: 'email', regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi },
  { label: 'dollar-amount', regex: /\$\s?\d[\d,]*(\.\d+)?/g },
  { label: 'ticket-id', regex: /\b(?:[A-Z]{2,}-\d+|#\d{3,}|INC\d{5,}|TICKET[-\s]?\d+|CASE[-\s]?\d+)\b/g },
  { label: 'software-version', regex: /\bv?\d+\.\d+(?:\.\d+)?\b/gi },
  { label: 'date', regex: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4})\b/gi },
  { label: 'code-span', regex: /`[^`]+`/g },
  { label: 'number', regex: /\b\d{2,}\b/g }, // 2+ digit standalone numbers (ticket #s, counts, etc.)
];

/**
 * Extract every value from `text` that should be protected: custom terms
 * the user configured, the defaults, plus pattern-matched values (URLs,
 * dates, emails, $ amounts, ticket IDs, versions, code spans, numbers).
 * Returns a de-duplicated array of exact substrings (original casing).
 */
export function extractProtectedTerms(text, customTerms = []) {
  if (!text) return [];
  const found = new Set();

  const namedTerms = [...DEFAULT_PROTECTED_TERMS, ...customTerms].filter(Boolean);
  for (const term of namedTerms) {
    if (!term.trim()) continue;
    const escaped = escapeRegExp(term.trim());
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = text.match(re);
    if (matches) matches.forEach((m) => found.add(m));
  }

  for (const { regex } of PATTERNS) {
    const matches = text.match(regex);
    if (matches) matches.forEach((m) => found.add(m.trim()));
  }

  return [...found].filter((t) => t.length > 0);
}

/**
 * After generation, check which protected terms from the original text
 * did NOT survive verbatim into the rewritten text. Returns an array of
 * human-readable warning strings (empty if everything survived).
 */
export function verifyProtectedTerms(protectedTerms, improvedText) {
  if (!improvedText) return protectedTerms.map((t) => missingWarning(t));
  const warnings = [];
  for (const term of protectedTerms) {
    if (!improvedText.includes(term)) {
      warnings.push(missingWarning(term));
    }
  }
  return warnings;
}

function missingWarning(term) {
  return `Protected value "${term}" from your original text was not found verbatim in the result — please double-check it before accepting.`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
