// Claude provider: request shape and response handling, using a stub client (no network, no key).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, ProviderError, createProvider, OfflineProvider } from '../server/ai/providers.js';

function stubClient(response) {
  const calls = [];
  return { calls, beta: { messages: { create: async (params) => { calls.push(params); if (response instanceof Error) throw response; return response; } } } };
}
const SCHEMA = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };

test('sends structured-output request with refusal fallbacks and parses JSON text', async () => {
  const client = stubClient({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":"b"}' }] });
  const p = new AnthropicProvider({ model: 'claude-opus-5-5', effort: 'medium', timeoutMs: 1000, client });
  const out = await p.complete({ system: 'sys', user: 'hello', schema: SCHEMA });
  assert.deepEqual(out, { a: 'b' });
  const params = client.calls[0];
  assert.equal(params.model, 'claude-opus-5-5');
  assert.equal(params.system, 'sys');
  assert.deepEqual(params.messages, [{ role: 'user', content: 'hello' }]);
  assert.deepEqual(params.output_config, { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } });
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.fallbacks, 'default');
  assert.equal(params.thinking, undefined, 'no disabled-thinking / budget_tokens on this model');
  assert.ok(params.max_tokens >= 1000);
});

test('fallbacks can be turned off', async () => {
  const client = stubClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"a":"b"}' }] });
  await new AnthropicProvider({ model: 'm', effort: 'low', timeoutMs: 1, client, useFallbacks: false }).complete({ system: 's', user: 'u', schema: SCHEMA });
  assert.equal(client.calls[0].betas, undefined);
  assert.equal(client.calls[0].fallbacks, undefined);
});

test('refusal, truncation, invalid JSON and API errors become ProviderErrors', async () => {
  const run = (resp) => new AnthropicProvider({ model: 'm', effort: 'low', timeoutMs: 1, client: stubClient(resp) }).complete({ system: 's', user: 'u', schema: SCHEMA });
  await assert.rejects(run({ stop_reason: 'refusal', content: [] }), (e) => e instanceof ProviderError && e.code === 'refusal');
  await assert.rejects(run({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a":' }] }), (e) => e.code === 'truncated');
  await assert.rejects(run({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }), (e) => e.code === 'invalid_output');
  await assert.rejects(run(new Anthropic.APIConnectionError({ message: 'down' })), (e) => e.code === 'connection');
  await assert.rejects(run(new Error('boom')), (e) => e.code === 'unknown');
});

test('provider selection: offline unless configured for anthropic', () => {
  assert.ok(createProvider({ provider: 'offline' }) instanceof OfflineProvider);
  const p = createProvider({ provider: 'anthropic', model: 'claude-opus-5-5', effort: 'medium', timeoutMs: 1000 });
  assert.equal(p.name, 'anthropic:claude-opus-5-5');
  assert.equal(p.live, true);
});
