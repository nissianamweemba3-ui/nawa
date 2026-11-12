// Application assembly: database, services, routes, request pipeline and static web client.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, ROOT } from './config.js';
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

const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

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

  const webRoot = path.join(ROOT, 'web');

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith('/api/')) return serveStatic(webRoot, url.pathname, res);
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

function serveStatic(webRoot, pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(webRoot, rel);
  const inside = file.startsWith(webRoot + path.sep);
  const target = inside && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(webRoot, 'index.html');
  const type = STATIC_TYPES[path.extname(target)] ?? 'application/octet-stream';
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'no-cache' });
  fs.createReadStream(target).pipe(res);
}
