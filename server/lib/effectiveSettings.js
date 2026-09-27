import { store } from './store.js';

/**
 * Merge stored settings (data/settings.json, editable from the Settings
 * page) with .env values. .env is treated as the fallback for anything
 * the user hasn't set in the UI — so you can either paste a key into
 * Settings, or just put it in .env and never touch the UI at all.
 */
export function getEffectiveSettings() {
  const stored = store.getSettings();
  return {
    ...stored,
    provider: stored.provider || process.env.WRITEMATE_PROVIDER || 'openai',
    openaiApiKey: stored.openaiApiKey || process.env.OPENAI_API_KEY || '',
    openaiModel: stored.openaiModel || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    anthropicApiKey: stored.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: stored.anthropicModel || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
    customBaseUrl: stored.customBaseUrl || process.env.CUSTOM_BASE_URL || '',
    customApiKey: stored.customApiKey || process.env.CUSTOM_API_KEY || '',
    customModel: stored.customModel || process.env.CUSTOM_MODEL || '',
    temperature:
      stored.temperature !== undefined && stored.temperature !== null
        ? stored.temperature
        : Number(process.env.DEFAULT_TEMPERATURE || 0.4),
    // 800 was too low for the grammar/rewrite JSON schema once you add a
    // realistic "issues"/"changes" array on top of the full corrected text —
    // and Gemini's 2.5/3.x flash models spend part of any token budget on
    // internal "thinking" before writing the visible JSON, so a tight budget
    // can get eaten before the model ever gets to close the JSON object,
    // producing truncated output. 2048 leaves real headroom for both.
    maxOutputTokens:
      stored.maxOutputTokens || Number(process.env.DEFAULT_MAX_OUTPUT_TOKENS || 2048),
  };
}

/** A version of settings safe to send to the frontend: API keys masked. */
export function maskSettings(settings) {
  const mask = (key) => (key ? `${'•'.repeat(Math.max(key.length - 4, 4))}${key.slice(-4)}` : '');
  return {
    ...settings,
    openaiApiKey: mask(settings.openaiApiKey),
    anthropicApiKey: mask(settings.anthropicApiKey),
    customApiKey: mask(settings.customApiKey),
    hasOpenaiKey: Boolean(settings.openaiApiKey),
    hasAnthropicKey: Boolean(settings.anthropicApiKey),
    hasCustomKey: Boolean(settings.customApiKey),
  };
}
