import { AIProvider, fetchWithTimeout, ProviderError } from './AIProvider.js';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class OpenAIProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generate({ systemPrompt, userPrompt, temperature = 0.4, maxTokens = 800, timeoutMs = 30000 }) {
    if (!this.isConfigured()) {
      throw new ProviderError('OpenAI provider is missing an API key.', { providerName: 'openai' });
    }

    const res = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      },
      timeoutMs
    );

    if (!res.ok) {
      const body = await safeText(res);
      throw new ProviderError(`OpenAI API error (${res.status}): ${body}`, {
        status: res.status,
        providerName: 'openai',
      });
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderError('OpenAI returned an empty response.', { providerName: 'openai' });
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
