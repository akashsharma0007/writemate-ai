import { Router } from 'express';
import { store } from '../lib/store.js';
import { getEffectiveSettings } from '../lib/effectiveSettings.js';
import { createProvider } from '../providers/index.js';
import { buildPrompt } from '../lib/promptBuilder.js';
import { parseModelResponse } from '../lib/responseParser.js';
import { computeWordDiff } from '../lib/diff.js';
import { extractProtectedTerms, verifyProtectedTerms } from '../lib/protectedTerms.js';
import { ErrorCodes, classifyProviderError } from '../lib/errorCodes.js';
import { recordError } from '../lib/errorLog.js';

const MAX_INPUT_CHARS = Number(process.env.MAX_INPUT_CHARS || 8000);
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);

export function createRewriteRouter(rateLimiter) {
  const router = Router();

  router.post('/rewrite', async (req, res) => {
    const { text, context, tone, action, customInstruction, profileId, templateId, applyWritingStyle } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      const entry = ErrorCodes.INPUT_MISSING_TEXT;
      return res.status(entry.httpStatus).json({ error: entry.message(), code: entry.code });
    }
    if (text.length > MAX_INPUT_CHARS) {
      const entry = ErrorCodes.INPUT_TOO_LONG;
      return res.status(entry.httpStatus).json({ error: entry.message({ max: MAX_INPUT_CHARS }), code: entry.code });
    }

    const limitCheck = rateLimiter.check();
    if (!limitCheck.allowed) {
      const entry = ErrorCodes.LOCAL_RATE_LIMIT;
      return res.status(entry.httpStatus).json({
        error: entry.message(),
        code: entry.code,
        retryAfterMs: limitCheck.retryAfterMs,
      });
    }

    const settings = getEffectiveSettings();
    let provider;
    try {
      provider = createProvider(settings);
    } catch (err) {
      const entry = ErrorCodes.UNKNOWN_PROVIDER;
      const errorId = recordError(entry, {
        httpStatus: entry.httpStatus,
        endpoint: '/api/rewrite',
        technicalMessage: err.message,
      });
      return res.status(entry.httpStatus).json({ error: entry.message({ provider: settings.provider }), code: entry.code, errorId });
    }
    if (!provider.isConfigured()) {
      const entry = ErrorCodes.AI_NOT_CONFIGURED;
      return res.status(entry.httpStatus).json({ error: entry.message({ provider: settings.provider }), code: entry.code });
    }

    const isGrammar = action === 'fix_grammar';
    const writingStyle = applyWritingStyle === false ? [] : store.getWritingStyle().map((e) => e.text);
    const customTerms = store.getCustomProtectedTerms();
    const protectedTerms = extractProtectedTerms(text, customTerms);
    const profile = profileId ? store.getProfiles().find((p) => p.id === profileId) : undefined;
    const template = templateId ? store.getTemplates().find((t) => t.id === templateId)?.name : undefined;

    const { systemPrompt, userPrompt } = buildPrompt({
      text,
      context,
      tone,
      action,
      customInstruction,
      writingStyle,
      protectedTerms,
      profile,
      template,
    });

    let raw;
    try {
      raw = await provider.generate({
        systemPrompt,
        userPrompt,
        temperature: Number(settings.temperature),
        maxTokens: Number(settings.maxOutputTokens),
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      const entry = classifyProviderError(err);
      const errorId = recordError(entry, {
        httpStatus: entry.httpStatus,
        endpoint: '/api/rewrite',
        provider: provider.name,
        action,
        textLength: text.length,
        upstreamStatus: typeof err.status === 'number' ? err.status : null,
        technicalMessage: err.message,
      });
      return res.status(entry.httpStatus).json({ error: entry.message(), code: entry.code, errorId });
    }

    const parsed = parseModelResponse(raw, { isGrammar });
    const resultText = isGrammar ? parsed.correctedText : parsed.improvedText;
    const termWarnings = verifyProtectedTerms(protectedTerms, resultText);
    const warnings = [...(parsed.warnings || []), ...termWarnings];
    const diff = computeWordDiff(text, resultText);

    // The AI still returned *something* (200, not a thrown error), but it
    // couldn't be parsed cleanly — still worth a code + reference id so this
    // is traceable the same way a hard failure is, without turning it into
    // a failed request the customer has to retry from scratch.
    if (parsed.parseIssue) {
      const entry = ErrorCodes.AI_RESPONSE_UNREADABLE;
      const errorId = recordError(entry, {
        httpStatus: entry.httpStatus,
        endpoint: '/api/rewrite',
        provider: provider.name,
        action,
        textLength: text.length,
        rawResponseLength: raw.length,
        parseIssue: parsed.parseIssue,
      });
      warnings.push(`Reference: ${entry.code} · ${errorId}`);
    }

    const responseBody = isGrammar
      ? {
          originalText: text,
          correctedText: parsed.correctedText,
          issues: parsed.issues,
          warnings,
          diff,
          protectedTerms,
        }
      : {
          originalText: text,
          improvedText: parsed.improvedText,
          changes: parsed.changes,
          warnings,
          detectedTone: parsed.detectedTone,
          diff,
          protectedTerms,
        };

    // Privacy mode ("do not save my text") wins over the history toggle.
    if (settings.historyEnabled && !settings.doNotSaveText) {
      store.addHistoryEntry({
        action,
        tone: tone || null,
        context: context || '',
        original: text,
        result: resultText,
      });
    }

    res.json(responseBody);
  });

  return router;
}
