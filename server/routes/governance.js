// Knowledge-base and regulatory governance (platform roles), plus read-only KB transparency for tenants.
import { audit } from '../lib/audit.js';
import { badRequest, forbidden, str, oneOf, isoDate, reply } from '../lib/http.js';
import { hasPermission, requirePermission } from '../auth/rbac.js';
import { listSources, listRequirements, getVersion, ingestVersion, reviewVersion, createSource } from '../kb/store.js';
import { captureChange, fetchOfficialSource, listChanges, getChange, reviewChange } from '../intel/regulatory.js';
import { describeChunk } from '../ai/assistant.js';
import { requireAuth } from './auth.js';

function requireKbRead(ctx) {
  requireAuth(ctx);
  if (!hasPermission(ctx, 'kb.read') && !hasPermission(ctx, 'kb.governance.read')) throw forbidden('Missing permission: kb.read');
}

export function registerGovernanceRoutes(r, svc) {
  const { db, index, config } = svc;

  r.get('/api/kb/sources', ({ ctx }) => { requireKbRead(ctx); return listSources(db); });
  r.get('/api/kb/requirements', ({ ctx }) => { requireKbRead(ctx); return listRequirements(db); });
  r.get('/api/kb/versions/:id', ({ ctx, params }) => { requireKbRead(ctx); return getVersion(db, params.id); });
  r.get('/api/kb/search', ({ ctx, query }) => {
    requireKbRead(ctx);
    const q = String(query.get('q') ?? '').slice(0, 300);
    return index.search(q, { k: 8 }).map((c) => ({ ...describeChunk(c), score: c.score }));
  });

  r.post('/api/kb/sources', ({ ctx, body }) => {
    requireAuth(ctx); requirePermission(ctx, 'kb.ingest');
    const id = createSource(db, { title: str(body, 'title', { max: 300 }), issuer: str(body, 'issuer', { max: 200 }),
      sourceType: oneOf(body, 'sourceType', ['act', 'regulation', 'guidance']), url: str(body, 'url', { required: false, max: 500 }) });
    audit(db, { userId: ctx.userId, action: 'kb.source_create', target: id });
    return reply(201, { id });
  });

  r.post('/api/kb/sources/:id/versions', ({ ctx, params, body }) => {
    requireAuth(ctx); requirePermission(ctx, 'kb.ingest');
    const versionId = ingestVersion(db, { sourceId: params.id, versionLabel: str(body, 'versionLabel', { max: 200 }),
      publishedDate: isoDate(body, 'publishedDate'), effectiveDate: isoDate(body, 'effectiveDate'), sections: body.sections, submittedBy: ctx.userId });
    audit(db, { userId: ctx.userId, action: 'kb.version_ingest', target: versionId, metadata: { sourceId: params.id } });
    return reply(201, { id: versionId, status: 'pending_review' });
  });

  r.post('/api/kb/versions/:id/review', ({ ctx, params, body }) => {
    requireAuth(ctx); requirePermission(ctx, 'kb.review');
    const decision = oneOf(body, 'decision', ['approve', 'reject']);
    const out = reviewVersion(db, { versionId: params.id, decision, reviewerId: ctx.userId, note: str(body, 'note', { required: false, max: 1000 }) });
    index.build(); // only approved, current versions are retrievable
    audit(db, { userId: ctx.userId, action: `kb.version_${decision}`, target: params.id, metadata: out });
    return out;
  });

  // ---- regulatory change governance ----
  r.get('/api/governance/changes', ({ ctx }) => {
    requireAuth(ctx); requirePermission(ctx, 'kb.governance.read');
    return listChanges(db).map(({ capturedText, ...c }) => ({ ...c, capturedChars: capturedText.length }));
  });

  r.get('/api/governance/changes/:id', ({ ctx, params }) => {
    requireAuth(ctx); requirePermission(ctx, 'kb.governance.read');
    return getChange(db, params.id);
  });

  r.post('/api/governance/changes', async ({ ctx, body }) => {
    requireAuth(ctx); requirePermission(ctx, 'regulatory.capture');
    const sourceId = str(body, 'sourceId', { max: 100 });
    const title = str(body, 'title', { max: 300 });
    let text = str(body, 'text', { required: false, max: 500_000 });
    let origin = 'manual capture';
    const url = str(body, 'url', { required: false, max: 1000 });
    if (!text && url) { text = await fetchOfficialSource(url, config.officialSourceHosts, { fetchImpl: svc.fetchImpl ?? fetch }); origin = url; }
    if (!text) throw badRequest("Provide either 'text' or an official-source 'url'");
    const id = captureChange(db, { sourceId, title, text, origin, capturedBy: ctx.userId });
    audit(db, { userId: ctx.userId, action: 'regulatory.capture', target: id, metadata: { sourceId, origin } });
    return reply(201, getChange(db, id));
  });

  r.post('/api/governance/changes/:id/review', ({ ctx, params, body }) => {
    requireAuth(ctx); requirePermission(ctx, 'regulatory.review');
    const decision = oneOf(body, 'decision', ['validate', 'reject']);
    const significance = decision === 'validate' ? oneOf(body, 'significance', ['low', 'medium', 'high']) : null;
    const codes = Array.isArray(body.requirementCodes) ? body.requirementCodes.filter((c) => typeof c === 'string') : [];
    const out = reviewChange(db, { changeId: params.id, reviewerId: ctx.userId, decision: decision === 'validate' ? 'validate' : 'reject',
      significance, requirementCodes: codes, versionLabel: str(body, 'versionLabel', { required: false, max: 200 }),
      note: str(body, 'note', { required: false, max: 2000 }) });
    if (out.status === 'validated') index.build();
    audit(db, { userId: ctx.userId, action: `regulatory.${out.status}`, target: params.id, metadata: out });
    return out;
  });
}
