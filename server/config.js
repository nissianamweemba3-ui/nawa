// Central configuration. All secrets come from the environment; nothing secret is committed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');

function int(name, dflt) {
  const v = process.env[name];
  if (v === undefined || v === '') return dflt;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export function loadConfig(overrides = {}) {
  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, 'data');
  const hasAnthropicCreds = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return {
    port: int('PORT', 3000),
    host: process.env.HOST ?? '127.0.0.1',
    dataDir,
    dbPath: overrides.dbPath ?? process.env.DB_PATH ?? path.join(dataDir, 'platform.sqlite'),
    storageDir: overrides.storageDir ?? path.join(dataDir, 'evidence'),
    // 32-byte hex key for AES-256-GCM encryption at rest. Generated per data dir in development if absent.
    dataKeyHex: overrides.dataKeyHex ?? process.env.DATA_KEY ?? null,
    sessionTtlMs: int('SESSION_TTL_MINUTES', 480) * 60_000,
    secureCookies: (process.env.SECURE_COOKIES ?? 'false') === 'true',
    maxUploadBytes: int('MAX_UPLOAD_BYTES', 5 * 1024 * 1024),
    loginRateLimitPerMinute: int('LOGIN_RATE_LIMIT_PER_MINUTE', 10),
    registerRateLimitPerMinute: overrides.registerRateLimit ?? int('REGISTER_RATE_LIMIT_PER_MINUTE', 5),
    ai: {
      provider: overrides.aiProvider ?? process.env.AI_PROVIDER ?? (hasAnthropicCreds ? 'anthropic' : 'offline'),
      model: process.env.AI_MODEL ?? 'claude-opus-5-5',
      effort: process.env.AI_EFFORT ?? 'medium',
      rateLimitPerMinute: overrides.aiRateLimit ?? int('AI_RATE_LIMIT_PER_MINUTE', 20),
      maxQuestionChars: int('AI_MAX_QUESTION_CHARS', 2000),
      timeoutMs: int('AI_TIMEOUT_MS', 120_000),
    },
    // Official sources the regulatory monitor may fetch from. Anything else must be pasted and reviewed.
    officialSourceHosts: (process.env.OFFICIAL_SOURCE_HOSTS ??
      'www.dpc.gov.zm,dpc.gov.zm,www.parliament.gov.zm,parliament.gov.zm,www.zambialii.org,zambialii.org')
      .split(',').map((s) => s.trim()).filter(Boolean),
  };
}
