import { diffWords } from 'diff';

/**
 * Word-level diff between the original and improved text, for the
 * "visual difference mode" in the brief (section 4). Returns an array of
 * { value, added?, removed? } segments — render added in green, removed
 * with strikethrough, unchanged as plain text.
 */
export function computeWordDiff(originalText, improvedText) {
  if (typeof originalText !== 'string' || typeof improvedText !== 'string') return [];
  return diffWords(originalText, improvedText).map((part) => ({
    value: part.value,
    added: Boolean(part.added),
    removed: Boolean(part.removed),
  }));
}
