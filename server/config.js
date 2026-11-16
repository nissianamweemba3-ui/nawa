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

// Public origin of the deployment, e.g. https://compliance.example.zm. Used for canonical URLs, the sitemap,
// social metadata and canonical-host redirects. Must be an http(s) origin with no path.
export function parseSiteUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  let u;
  try { u = new URL(value); } catch { throw new Error('SITE_URL must be an absolute URL such as https://compliance.example.zm'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('SITE_URL must use http or https');
  if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash || u.username || u.password) {
    throw new Error('SITE_URL must be an origin only, with no path, query, fragment or credentials');
  }
  return u.origin;
}

export function loadConfig(overrides = {}) {
  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? path.join(ROOT, 'data');
  const hasAnthropicCreds = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const env = (name) => (overrides.env && name in overrides.env ? overrides.env[name] : process.env[name]);
  return {
    production: (env('NODE_ENV') ?? '') === 'production',
    siteUrl: parseSiteUrl(env('SITE_URL')),
    // Behind a reverse proxy that sets X-Forwarded-Proto, allows redirecting plain-HTTP requests to HTTPS.
    trustProxy: (env('TRUST_PROXY') ?? 'false') === 'true',
    // The organisation operating this deployment, shown in the privacy policy, terms and structured data.
    operatorName: (env('OPERATOR_NAME') ?? '').trim() || null,
    contactEmail: (env('CONTACT_EMAIL') ?? '').trim() || null,
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

// Settings a production deployment must have. Returns a list of problems; empty means ready.
export function productionConfigProblems(config) {
  const problems = [];
  if (!config.siteUrl) problems.push('SITE_URL is not set (the public https origin, used for canonical URLs and redirects)');
  else if (!config.siteUrl.startsWith('https://')) problems.push('SITE_URL must use https in production');
  if (!config.dataKeyHex) problems.push('DATA_KEY is not set (64 hex characters; encrypts evidence and MFA secrets)');
  if (!config.secureCookies) problems.push('SECURE_COOKIES must be true in production (cookies only over HTTPS)');
  if (!config.operatorName) problems.push('OPERATOR_NAME is not set (the organisation responsible, shown in the privacy policy and terms)');
  if (!config.contactEmail) problems.push('CONTACT_EMAIL is not set (privacy and support contact shown on the legal pages)');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(config.contactEmail)) problems.push('CONTACT_EMAIL is not a valid email address');
  return problems;
}
