// Model providers behind the AI gateway. API keys stay server-side; the browser never talks to a model.
//
// - AnthropicProvider: Claude via the official SDK, with structured JSON output and refusal handling.
// - OfflineProvider: no model call. The gateway then uses each feature's deterministic composer, so every
//   AI feature works (in an extractive, source-quoting form) without credentials and in tests.
import Anthropic from '@anthropic-ai/sdk';

export class ProviderError extends Error {
  constructor(code, message) { super(message ?? code); this.code = code; }
}

export class OfflineProvider {
  get name() { return 'offline'; }
  get live() { return false; }
  async complete() { throw new ProviderError('offline', 'Offline provider does not call a model'); }
}

export class AnthropicProvider {
  constructor({ model, effort, timeoutMs, client = null, useFallbacks = true }) {
    this.model = model;
    this.effort = effort;
    this.useFallbacks = useFallbacks;
    // Credentials are resolved by the SDK from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN on the server.
    this.client = client ?? new Anthropic({ timeout: timeoutMs, maxRetries: 2 });
  }

  get name() { return `anthropic:${this.model}`; }
  get live() { return true; }

  async complete({ system, user, schema }) {
    const params = {
      model: this.model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: this.effort, format: { type: 'json_schema', schema } },
    };
    if (this.useFallbacks) {
      // Server-side refusal fallback: a declined request is re-run on Anthropic's recommended fallback model.
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    let response;
    try {
      response = await this.client.beta.messages.create(params);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new ProviderError('rate_limited', 'Model provider rate limit reached');
      if (err instanceof Anthropic.AuthenticationError) throw new ProviderError('auth', 'Model provider authentication failed');
      if (err instanceof Anthropic.APIConnectionError) throw new ProviderError('connection', 'Could not reach the model provider');
      if (err instanceof Anthropic.APIError) throw new ProviderError('api_error', `Model provider error (${err.status ?? 'unknown'})`);
      throw new ProviderError('unknown', 'Unexpected model provider failure');
    }
    if (response.stop_reason === 'refusal') throw new ProviderError('refusal', 'The model declined this request');
    if (response.stop_reason === 'max_tokens') throw new ProviderError('truncated', 'The model response was truncated');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError('invalid_output', 'The model returned output that was not valid JSON');
    }
  }
}

export function createProvider(aiConfig) {
  if (aiConfig.provider === 'anthropic') {
    return new AnthropicProvider({
      model: aiConfig.model,
      effort: aiConfig.effort,
      timeoutMs: aiConfig.timeoutMs,
      useFallbacks: process.env.AI_FALLBACKS !== 'off',
    });
  }
  return new OfflineProvider();
}
