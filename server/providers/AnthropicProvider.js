import { AIProvider, fetchWithTimeout, ProviderError } from './AIProvider.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-haiku-20241022';
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generate({ systemPrompt, userPrompt, temperature = 0.4, maxTokens = 800, timeoutMs = 30000 }) {
    if (!this.isConfigured()) {
      throw new ProviderError('Anthropic provider is missing an API key.', { providerName: 'anthropic' });
    }

    const res = await fetchWithTimeout(
      `${this.baseUrl}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      },
      timeoutMs
    );

    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError(`Anthropic API error (${res.status}): ${body}`, {
        status: res.status,
        providerName: 'anthropic',
      });
    }

    const json = await res.json();
    const content = json?.content?.[0]?.text;
    if (!content) {
      throw new ProviderError('Anthropic returned an empty response.', { providerName: 'anthropic' });
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
