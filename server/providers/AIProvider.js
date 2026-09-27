/**
 * AIProvider — common interface every provider implements.
 *
 * This is the seam the whole app is built around (see PROJECT PRINCIPLE 9
 * in the brief this was built from): nothing above this layer knows or
 * cares whether it's talking to OpenAI, Anthropic, or a local model.
 *
 * Subclasses must implement:
 *   async generate({ systemPrompt, userPrompt, temperature, maxTokens, timeoutMs })
 *     -> Promise<string>  (raw text response from the model)
 */
export class AIProvider {
  constructor(config = {}) {
    if (new.target === AIProvider) {
      throw new Error('AIProvider is abstract — instantiate a subclass instead.');
    }
    this.config = config;
  }

  // eslint-disable-next-line no-unused-vars
  async generate({ systemPrompt, userPrompt, temperature, maxTokens, timeoutMs }) {
    throw new Error('generate() must be implemented by the provider subclass.');
  }

  /** Human-readable name shown in the UI / logs (never logs request content). */
  get name() {
    return this.constructor.name;
  }

  /** True if this provider believes it has enough config to run (e.g. an API key). */
  isConfigured() {
    return false;
  }
}

/** Small helper: fetch with a hard timeout, shared by every provider. */
export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 30000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to AI provider timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class ProviderError extends Error {
  constructor(message, { status, providerName } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.providerName = providerName;
  }
}
