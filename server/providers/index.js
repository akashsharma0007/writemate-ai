import { OpenAIProvider } from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { CustomProvider } from './CustomProvider.js';

/**
 * createProvider — the one place that decides which AIProvider subclass
 * to instantiate. Settings (from data/settings.json, falling back to
 * .env) flow in; a ready-to-use provider instance flows out.
 */
export function createProvider(settings) {
  const providerType = (settings.provider || 'openai').toLowerCase();

  switch (providerType) {
    case 'openai':
      return new OpenAIProvider({
        apiKey: settings.openaiApiKey,
        model: settings.openaiModel,
      });
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: settings.anthropicApiKey,
        model: settings.anthropicModel,
      });
    case 'custom':
      return new CustomProvider({
        apiKey: settings.customApiKey,
        model: settings.customModel,
        baseUrl: settings.customBaseUrl,
      });
    default:
      throw new Error(`Unknown AI provider: "${providerType}"`);
  }
}

export const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'custom'];
