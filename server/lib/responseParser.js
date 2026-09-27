/**
 * Parses the raw text a provider returns into the structured shape the
 * frontend expects. Models occasionally wrap JSON in markdown fences or
 * add stray text — this strips that defensively rather than trusting the
 * model to always follow instructions perfectly.
 */
export function parseModelResponse(raw, { isGrammar }) {
  const jsonText = extractJson(raw);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // The JSON didn't parse cleanly — most often because the response got
    // cut off mid-object by the provider's output-token limit (see
    // maxOutputTokens in Settings). Before giving up entirely, try to
    // salvage just the one field that matters most: the field holding the
    // full corrected/improved text is written FIRST in the schema, so it's
    // often complete even when the "issues"/"changes" array further down
    // got truncated. Recovering it turns "raw JSON dump" into "your actual
    // text, minus the itemized suggestions."
    const fieldName = isGrammar ? 'correctedText' : 'improvedText';
    const recovered = extractStringField(jsonText, fieldName);

    if (recovered !== null) {
      const truncatedWarning =
        'The AI response was cut off before it finished (likely the Max Output Tokens setting is too low for this request) — showing the recovered text, but the itemized suggestions list could not be recovered. Try increasing Max Output Tokens in Settings.';
      // parseIssue (not just the warning string) lets the caller (routes/
      // rewrite.js) log this to errorLog.js with a proper code + reference
      // id, without having to string-match the warning text.
      return isGrammar
        ? { correctedText: recovered, issues: [], warnings: [truncatedWarning], parseIssue: 'truncated_recovered' }
        : { improvedText: recovered, changes: [], warnings: [truncatedWarning], detectedTone: null, parseIssue: 'truncated_recovered' };
    }

    // Nothing recoverable — fall back to showing the whole raw response.
    return isGrammar
      ? {
          correctedText: raw.trim(),
          issues: [],
          warnings: ['Could not parse a structured response from the AI provider — showing raw output.'],
          parseIssue: 'unparseable',
        }
      : {
          improvedText: raw.trim(),
          changes: [],
          warnings: ['Could not parse a structured response from the AI provider — showing raw output.'],
          detectedTone: null,
          parseIssue: 'unparseable',
        };
  }

  if (isGrammar) {
    return {
      correctedText: typeof parsed.correctedText === 'string' ? parsed.correctedText : raw.trim(),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      parseIssue: null,
    };
  }

  return {
    improvedText: typeof parsed.improvedText === 'string' ? parsed.improvedText : raw.trim(),
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    detectedTone: typeof parsed.detectedTone === 'string' ? parsed.detectedTone : null,
    parseIssue: null,
  };
}

function extractJson(raw) {
  const trimmed = raw.trim();

  // Look for a ```json ... ``` or ``` ... ``` fenced block ANYWHERE in the
  // text (not just when the whole response is exactly a fence) — some
  // providers (Gemini's OpenAI-compat endpoint in particular, since it
  // doesn't honor response_format the way OpenAI does) add a sentence of
  // preamble or a closing remark around the fence.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const searchIn = fenceMatch ? fenceMatch[1] : trimmed;

  // Scan for the first complete top-level {...} object by tracking brace
  // depth and string state char-by-char, rather than naively pairing the
  // first "{" with the LAST "}" in the text — that naive approach breaks
  // as soon as any trailing prose contains a stray brace of its own.
  const start = searchIn.indexOf('{');
  if (start === -1) return searchIn.trim();

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < searchIn.length; i++) {
    const ch = searchIn[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return searchIn.slice(start, i + 1);
    }
  }
  // Unbalanced (likely truncated by a token limit) — return what we have;
  // JSON.parse will throw and the caller's catch handles the fallback.
  return searchIn.slice(start);
}

/**
 * Best-effort extraction of one top-level `"fieldName": "..."` string value
 * out of text that may not be valid JSON (e.g. truncated mid-object). Scans
 * char-by-char from just after the opening quote so escaped characters
 * (`\"`, `\\`, `\n`, ...) are handled the same way JSON.parse would handle
 * them, rather than a regex that can be fooled by an escaped quote. Returns
 * the unescaped string, or null if the field's opening quote is never found
 * or its value is empty after trimming.
 */
function extractStringField(text, fieldName) {
  const keyMatch = text.match(new RegExp(`"${fieldName}"\\s*:\\s*"`));
  if (!keyMatch) return null;

  const start = keyMatch.index + keyMatch[0].length;
  let result = '';
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      const next = text[i + 1];
      if (next === undefined) break; // truncated mid-escape
      const escapeMap = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f' };
      result += next in escapeMap ? escapeMap[next] : next;
      i++; // consumed the escaped char too
      continue;
    }
    if (ch === '"') break; // reached the closing quote — value is complete
    result += ch;
  }

  // Even an unterminated (truncated mid-string) value is still useful to
  // show the user — it's the model's actual words, just possibly missing
  // its last few characters. Only refuse if there's nothing there at all.
  const trimmed = result.trim();
  if (!trimmed) return null;
  return trimmed;
}
