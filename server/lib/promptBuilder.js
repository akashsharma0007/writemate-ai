/**
 * promptBuilder — turns { text, context, tone, action, customInstruction,
 * writingStyle, protectedTerms, profile } into the system/user prompt
 * pair sent to whichever AIProvider is active.
 *
 * This is the AI Engine contract from the brief (section 26):
 *   Input:  { text, context, tone, action, writingStyle, profile }
 *   Output: { originalText, improvedText, changes, warnings, detectedTone }
 * The model is instructed to return that shape (or the grammar-specific
 * shape below) as strict JSON, which server/lib/responseParser.js parses.
 */

export const TONES = [
  'Professional',
  'Friendly',
  'Formal',
  'Casual',
  'Confident',
  'Diplomatic',
  'Concise',
  'Empathetic',
  'Direct',
  'Technical',
  'Customer-Friendly',
  'Executive',
  'Neutral',
];

// action -> the core transformation instruction given to the model.
export const ACTIONS = {
  fix_grammar: 'Fix only spelling, grammar, punctuation, and sentence-structure errors. Do not change wording, tone, or style beyond what correctness requires.',
  improve: 'Improve clarity and readability while preserving the original tone, meaning, and level of formality.',
  rephrase: 'Rephrase the text using different wording while preserving the exact meaning.',
  professional: 'Make the text sound professional and workplace-appropriate.',
  friendly: 'Make the text warmer and more approachable without becoming unprofessional.',
  concise: 'Remove unnecessary words and redundancy. Say the same thing in fewer words.',
  clearer: 'Restructure and simplify the sentence structure so the meaning is unmistakable.',
  confident: 'Make the message sound confident and direct, without becoming arrogant or pushy.',
  diplomatic: 'Reduce harshness and bluntness; make the message tactful while keeping the substance intact.',
  simplify: 'Simplify vocabulary and sentence structure so it is easy to read quickly.',
  expand: 'Expand the text with more detail and complete sentences, based only on what is stated or provided in the context — never invent new facts.',
  custom: 'Follow the custom instruction provided below precisely, while still honoring every rule in this system prompt.',
};

const CORE_PRINCIPLES = `You are the rewriting engine inside WriteMate AI, a personal writing assistant.
Follow these rules exactly, in order of priority:

1. PRESERVE MEANING. Never add facts, claims, numbers, or commitments that were not present in the original text or the provided context. Do not invent information.
2. NEVER alter protected values. A list of "Protected values" appears below (technical terms, ticket/case IDs, customer names, product names, database/table names, URLs, email addresses, dates, dollar amounts, version numbers, error messages). Reproduce every one of them EXACTLY as given, in the same form, in your output. If a protected value does not naturally fit the rewritten sentence, keep the sentence structure that lets it fit rather than dropping or altering the value.
3. DO NOT over-formalize. Natural, human writing beats unnecessarily complicated writing. Only escalate formality if the requested tone or action explicitly calls for it. For example, "Can you check this when you get a chance?" must stay casual and short unless a formal tone was requested — never turn it into "I kindly request that you review this at your earliest convenience."
4. Sound like a real person, not an AI. Avoid generic filler, corporate buzzwords, and robotic phrasing unless the user's own writing style (given below) calls for that register.
5. Use the optional "Context" and "Writing style" sections below to inform word choice and framing, but do not restate the context verbatim back to the user — use it as background only.
6. If you are not confident a change is safe (e.g. it's ambiguous whether a value is a protected identifier), leave it untouched and note it in "warnings" instead of guessing.

You must respond with ONLY a single valid JSON object — no markdown fences, no commentary before or after it.`;

const GRAMMAR_SCHEMA = `Respond with exactly this JSON shape:
{
  "correctedText": string,      // the full text with ONLY grammar/spelling/punctuation fixed
  "issues": [
    {
      "type": string,           // one of: spelling, grammar, punctuation, sentence-structure, repeated-word, awkward-phrasing, missing-article, subject-verb-agreement, capitalization
      "original": string,       // the exact original fragment
      "suggestion": string,     // the corrected fragment
      "explanation": string     // one short sentence explaining the fix
    }
  ],
  "warnings": [string]          // e.g. protected values you were unsure about
}`;

const REWRITE_SCHEMA = `Respond with exactly this JSON shape:
{
  "improvedText": string,       // the full rewritten text
  "changes": [
    {
      "type": string,           // one of: added, removed, changed
      "original": string,       // fragment from the original (empty string if type is "added")
      "updated": string         // fragment in the new version (empty string if type is "removed")
    }
  ],
  "warnings": [string],         // anything the user should double-check (e.g. an ambiguous protected value)
  "detectedTone": string        // your best label for the resulting tone, e.g. "Professional"
}`;

export function buildPrompt({
  text,
  context,
  tone,
  action = 'improve',
  customInstruction,
  writingStyle = [],
  protectedTerms = [],
  profile,
  template,
}) {
  const isGrammar = action === 'fix_grammar';
  const actionInstruction = ACTIONS[action] || ACTIONS.improve;

  const sections = [CORE_PRINCIPLES];

  sections.push(`\nTASK: ${actionInstruction}`);

  if (action === 'custom' && customInstruction) {
    sections.push(`\nCUSTOM INSTRUCTION FROM USER:\n${customInstruction}`);
  } else if (customInstruction) {
    sections.push(`\nADDITIONAL INSTRUCTION FROM USER:\n${customInstruction}`);
  }

  if (tone && !isGrammar) {
    sections.push(`\nTARGET TONE: ${tone}`);
  }

  if (profile) {
    sections.push(`\nCONTEXT PROFILE: ${profile.name}${profile.description ? ` — ${profile.description}` : ''}`);
  }

  if (template) {
    sections.push(`\nMESSAGE TYPE / TEMPLATE: ${template}`);
  }

  if (writingStyle.length > 0) {
    sections.push(`\nUSER'S PREFERRED WRITING STYLE (apply these consistently):\n${writingStyle.map((s) => `- ${s}`).join('\n')}`);
  }

  if (protectedTerms.length > 0) {
    sections.push(`\nPROTECTED VALUES (reproduce exactly, do not alter or remove):\n${protectedTerms.map((t) => `- ${t}`).join('\n')}`);
  }

  sections.push(`\n${isGrammar ? GRAMMAR_SCHEMA : REWRITE_SCHEMA}`);

  const systemPrompt = sections.join('\n');

  const userParts = [];
  if (context && context.trim()) {
    userParts.push(`Context:\n${context.trim()}`);
  }
  userParts.push(`Original text:\n${text}`);
  const userPrompt = userParts.join('\n\n');

  return { systemPrompt, userPrompt };
}
