import { AIProvider, fetchWithTimeout, ProviderError } from './AIProvider.js';

/**
 * CustomProvider — talks to any OpenAI-compatible chat-completions endpoint.
 * This is the "bring your own free model" path: point it at a local
 * Ollama / LM Studio / vLLM server (e.g. http://localhost:11434/v1) and
 * you can run WriteMate with zero per-token cost.
 */
export class CustomProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || ''; // many local servers don't need one
    this.model = config.model || 'local-model';
    this.baseUrl = config.baseUrl;
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.model);
  }

  async generate({ systemPrompt, userPrompt, temperature = 0.4, maxTokens = 800, timeoutMs = 30000 }) {
    if (!this.isConfigured()) {
      throw new ProviderError('Custom provider is missing a base URL or model name.', {
        providerName: 'custom',
      });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const body = {
      model: this.model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    // Gemini's OpenAI-compatible endpoint runs its 2.5/3.x flash models with
    // "thinking" on by default, and those invisible reasoning tokens are
    // drawn from the SAME max_tokens budget as the visible reply — on a
    // tight budget the model can burn it all on thinking and never finish
    // (or even start) the JSON we asked for, which looks like truncated/
    // missing output. `reasoning_effort` is Google's documented knob for
    // this on the OpenAI-compat surface; harmless to omit if the model
    // doesn't support it, so only send it for Gemini's own endpoint rather
    // than guessing for arbitrary custom/local servers.
    if (this.baseUrl.includes('generativelanguage.googleapis.com')) {
      body.reasoning_effort = 'low';
    }

    const res = await fetchWithTimeout(
      `${this.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      timeoutMs
    );

    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError(`Custom provider error (${res.status}): ${body}`, {
        status: res.status,
        providerName: 'custom',
      });
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderError('Custom provider returned an empty response.', { providerName: 'custom' });
    }
    return content;
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}
