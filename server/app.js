// Application assembly: database, services, routes, request pipeline and static web client.
import http from 'node:http';
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { seedKnowledgeBase } from './kb/store.js';
import { LegalIndex } from './kb/retrieval.js';
import { resolveDataKey, EvidenceStore } from './lib/storage.js';
import { createProvider } from './ai/providers.js';
import { AIGateway } from './ai/gateway.js';
import { ComplianceAssistant } from './ai/assistant.js';
import { Router, HttpError, Reply, sendJson, readJsonBody, SECURITY_HEADERS, RateLimiter } from './lib/http.js';
import { loadContext } from './auth/sessions.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerComplianceRoutes } from './routes/compliance.js';
import { registerIntelligenceRoutes } from './routes/intelligence.js';
import { registerGovernanceRoutes } from './routes/governance.js';
import { handlePublic, canonicalRedirect } from './site/router.js';

export function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const db = openDatabase(config.dbPath);
  seedKnowledgeBase(db);
  const index = new LegalIndex(db);
  const dataKey = resolveDataKey(config);
  const store = new EvidenceStore(config.storageDir, dataKey);
  const provider = overrides.provider ?? createProvider(config.ai);
  const gateway = new AIGateway({ db, provider, config });
  const assistant = new ComplianceAssistant({ db, index, gateway });
  const svc = { config, db, index, store, dataKey, gateway, assistant, loginLimiter: new RateLimiter(config.loginRateLimitPerMinute),
    registerLimiter: new RateLimiter(config.registerRateLimitPerMinute), fetchImpl: overrides.fetchImpl };

  const router = new Router();
  registerAuthRoutes(router, svc);
  registerComplianceRoutes(router, svc);
  registerIntelligenceRoutes(router, svc);
  registerGovernanceRoutes(router, svc);

  const hsts = config.production && config.siteUrl?.startsWith('https://');

  async function handle(req, res) {
    try {
      let url;
      try { url = new URL(req.url, 'http://localhost'); } catch { throw new HttpError(400, 'Malformed request URL'); }
      if (hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      const target = canonicalRedirect(req, config, url);
      if (target) {
        res.writeHead(301, { ...SECURITY_HEADERS, Location: target, 'Cache-Control': 'no-cache', 'Content-Length': 0 });
        res.end();
        return;
      }
      if (!url.pathname.startsWith('/api/')) return handlePublic(req, res, config, url);
      const match = router.match(req.method, url.pathname);
      if (!match) throw new HttpError(404, 'Not found');
      if (match.methodNotAllowed) throw new HttpError(405, 'Method not allowed');
      if (req.method !== 'GET') {
        // CSRF defence in depth (cookies are already SameSite=Strict): JSON-only bodies and same-origin requests.
        const ct = req.headers['content-type'] ?? '';
        if (!ct.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
        const origin = req.headers.origin;
        if (origin) {
          let originHost = null;
          try { originHost = new URL(origin).host; } catch { /* malformed or "null" origin */ }
          if (originHost !== req.headers.host) throw new HttpError(403, 'Cross-origin request rejected');
        }
      }
      const body = req.method === 'GET' ? {} : await readJsonBody(req, Math.ceil(config.maxUploadBytes * 1.4) + 64_000);
      const ctx = loadContext(db, req);
      const result = await match.handler({ req, res, ctx, body, params: match.params, query: url.searchParams });
      if (res.writableEnded) return;
      if (result instanceof Reply) sendJson(res, result.status, result.body ?? {}, result.headers);
      else sendJson(res, 200, result ?? {});
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) });
      } else {
        console.error('Unhandled error:', err?.stack ?? err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
    }
  }

  const server = http.createServer((req, res) => { handle(req, res); });
  return { server, svc, db, config, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}
