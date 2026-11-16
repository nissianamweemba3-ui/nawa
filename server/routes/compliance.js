// Core compliance management: organisation profile, assessments, evidence, tasks, documents, audit.
import { newId, sha256 } from '../lib/crypto.js';
import { nowIso } from '../db.js';
import { audit, verifyAuditChain } from '../lib/audit.js';
import { badRequest, notFound, str, oneOf, isoDate, sendJson, SECURITY_HEADERS, reply } from '../lib/http.js';
import { requireOrgPermission, hasPermission } from '../auth/rbac.js';
import { TenantRepo } from '../tenancy.js';
import { listControls } from '../kb/store.js';
import { scoreAssessment, ANSWERS } from '../compliance/scoring.js';
import { latestAssessment, assessmentHistory, hydrateAssessment, evidenceStatus } from '../compliance/state.js';
import { generateDocument, DOC_TYPES } from '../compliance/docgen.js';
import { requireAuth, readOrgFields } from './auth.js';

export const EVIDENCE_TYPES = {
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'text/html': '.html',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function formatTask(t) {
  return { id: t.id, title: t.title, description: t.description, controlId: t.control_id, priority: t.priority, status: t.status,
    dueDate: t.due_date, source: t.source, createdBy: t.created_by, createdAt: t.created_at, updatedAt: t.updated_at };
}

export function createTask(db, ctx, { title, description = '', controlId = null, priority, dueDate = null, source }) {
  const repo = new TenantRepo(db, ctx.orgId);
  const now = nowIso();
  const row = repo.insert('tasks', { id: newId(), title, description, control_id: controlId, priority, status: 'open',
    due_date: dueDate, source, created_by: ctx.userId, created_at: now, updated_at: now });
  audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'task.create', target: row.id, metadata: { source, controlId } });
  return formatTask(row);
}

export function formatEvidence(e) {
  return { id: e.id, title: e.title, controlId: e.control_id, filename: e.filename, mime: e.mime, size: e.size, sha256: e.sha256,
    version: e.version, supersedes: e.supersedes, validUntil: e.valid_until, uploadedBy: e.uploaded_by, createdAt: e.created_at };
}

function safeFilename(name) {
  const base = String(name).split(/[\\/]/).pop().replace(/[^\w .()-]/g, '_').slice(0, 150);
  return base || 'file';
}

export function registerComplianceRoutes(r, svc) {
  const { db, store, config, index } = svc;
  const auth = (ctx, perm) => { requireAuth(ctx); requireOrgPermission(ctx, perm); return new TenantRepo(db, ctx.orgId); };

  // ---- organisation ----
  r.get('/api/org', ({ ctx }) => {
    const repo = auth(ctx, 'org.read');
    const o = repo.organisation();
    return { id: o.id, name: o.name, sector: o.sector, employees: o.employees, role: o.role,
      processesSensitive: Boolean(o.processes_sensitive), transfersAbroad: Boolean(o.transfers_abroad), createdAt: o.created_at };
  });

  r.patch('/api/org', ({ ctx, body }) => {
    auth(ctx, 'org.update');
    const fields = readOrgFields(body, { partial: true });
    const cols = Object.keys(fields);
    if (cols.length === 0) throw badRequest('No changes supplied');
    db.prepare(`UPDATE organisations SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...cols.map((c) => fields[c]), ctx.orgId);
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'org.update', target: ctx.orgId, metadata: { fields: cols } });
    return { ok: true };
  });

  // ---- controls (assessment questions from the knowledge base) ----
  r.get('/api/controls', ({ ctx }) => {
    requireAuth(ctx);
    if (!hasPermission(ctx, 'kb.read') && !hasPermission(ctx, 'kb.governance.read')) requireOrgPermission(ctx, 'kb.read');
    return listControls(db);
  });

  // ---- assessments (deterministic scoring) ----
  r.post('/api/assessments', ({ ctx, body }) => {
    const repo = auth(ctx, 'assessment.create');
    const controls = listControls(db);
    if (!body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) throw badRequest("'answers' must be an object");
    const answers = {};
    for (const c of controls) {
      const a = body.answers[c.id];
      if (a === undefined || a === null || a === '') continue;
      if (!ANSWERS.includes(a)) throw badRequest(`Answer for ${c.id} must be one of: ${ANSWERS.join(', ')}`);
      answers[c.id] = a;
    }
    const scored = scoreAssessment(controls, answers);
    const row = repo.insert('assessments', { id: newId(), created_by: ctx.userId, answers_json: JSON.stringify(answers), score: scored.score,
      risk: scored.risk, gaps_json: JSON.stringify(scored.gaps), engine_version: scored.engineVersion, created_at: nowIso() });
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'assessment.create', target: row.id, metadata: { score: scored.score, risk: scored.risk } });
    return reply(201, { ...hydrateAssessment(row), breakdown: scored.breakdown, explanation: scored.explanation });
  });

  r.get('/api/assessments', ({ ctx }) => assessmentHistory(auth(ctx, 'assessment.read')));

  r.get('/api/assessments/latest', ({ ctx }) => {
    const repo = auth(ctx, 'assessment.read');
    const latest = latestAssessment(repo);
    if (!latest) return { assessment: null };
    const scored = scoreAssessment(listControls(db), latest.answers);
    return { assessment: latest, breakdown: scored.breakdown, explanation: scored.explanation };
  });

  // ---- evidence (encrypted at rest, versioned) ----
  r.post('/api/evidence', ({ ctx, body }) => {
    const repo = auth(ctx, 'evidence.upload');
    const title = str(body, 'title', { max: 200 });
    const filename = safeFilename(str(body, 'filename', { max: 255 }));
    const mime = oneOf(body, 'mime', Object.keys(EVIDENCE_TYPES));
    const controlId = str(body, 'controlId', { required: false, max: 64 });
    if (controlId && !listControls(db).some((c) => c.id === controlId)) throw badRequest('Unknown controlId');
    const validUntil = isoDate(body, 'validUntil');
    if (typeof body.contentBase64 !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(body.contentBase64)) throw badRequest("'contentBase64' must be base64");
    const buf = Buffer.from(body.contentBase64, 'base64');
    if (buf.length === 0) throw badRequest('File is empty');
    if (buf.length > config.maxUploadBytes) throw badRequest(`File exceeds ${config.maxUploadBytes} bytes`);
    // Basic content sniffing so the declared type cannot be used to smuggle other formats.
    if (mime === 'application/pdf' && buf.subarray(0, 4).toString() !== '%PDF') throw badRequest('File content is not a PDF');
    if (mime.includes('openxmlformats') && buf.readUInt32LE(0) !== 0x04034b50) throw badRequest('File content is not an Office document');
    if (mime === 'image/png' && buf.readUInt32BE(0) !== 0x89504e47) throw badRequest('File content is not a PNG');
    if (mime === 'image/jpeg' && (buf[0] !== 0xff || buf[1] !== 0xd8)) throw badRequest('File content is not a JPEG');
    let version = 1, supersedes = null;
    if (body.supersedes) {
      const prev = repo.get('evidence', String(body.supersedes));
      if (!prev) throw notFound('Evidence to supersede not found');
      version = prev.version + 1; supersedes = prev.id;
    }
    const id = newId();
    const storageKey = newId();
    store.put(ctx.orgId, storageKey, buf);
    const row = repo.insert('evidence', { id, control_id: controlId, title, filename, mime, size: buf.length, sha256: sha256(buf),
      storage_key: storageKey, version, supersedes, valid_until: validUntil, uploaded_by: ctx.userId, created_at: nowIso() });
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'evidence.upload', target: id, metadata: { controlId, sha256: row.sha256, version } });
    return reply(201, formatEvidence(row));
  });

  r.get('/api/evidence', ({ ctx }) => {
    const repo = auth(ctx, 'evidence.read');
    const controls = listControls(db);
    return { items: repo.list('evidence').map(formatEvidence), status: evidenceStatus(repo, controls) };
  });

  r.get('/api/evidence/:id/download', ({ ctx, params, res }) => {
    const repo = auth(ctx, 'evidence.read');
    const e = repo.get('evidence', params.id);
    if (!e) throw notFound('Evidence not found');
    const buf = store.get(ctx.orgId, e.storage_key);
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'evidence.download', target: e.id });
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${e.filename.replace(/"/g, '')}"`, 'Content-Length': buf.length });
    res.end(buf);
  });

  // ---- tasks / remediation ----
  r.get('/api/tasks', ({ ctx }) => auth(ctx, 'task.read').list('tasks').map(formatTask));

  r.post('/api/tasks', ({ ctx, body }) => {
    auth(ctx, 'task.create');
    const controlId = str(body, 'controlId', { required: false, max: 64 });
    if (controlId && !listControls(db).some((c) => c.id === controlId)) throw badRequest('Unknown controlId');
    const source = oneOf(body, 'source', ['manual', 'assessment', 'copilot', 'insight'], { required: false }) ?? 'manual';
    return reply(201, createTask(db, ctx, {
      title: str(body, 'title', { max: 200, min: 3 }), description: str(body, 'description', { required: false, max: 2000 }) ?? '',
      controlId, priority: oneOf(body, 'priority', ['high', 'medium', 'low']), dueDate: isoDate(body, 'dueDate'), source,
    }));
  });

  r.patch('/api/tasks/:id', ({ ctx, body, params }) => {
    const repo = auth(ctx, 'task.update');
    const task = repo.get('tasks', params.id);
    if (!task) throw notFound('Task not found');
    const changes = {};
    const status = oneOf(body, 'status', ['open', 'in_progress', 'done'], { required: false });
    if (status) changes.status = status;
    if (body.dueDate !== undefined || body.priority !== undefined) {
      requireOrgPermission(ctx, 'task.create'); // re-planning is reserved for compliance officers and above
      if (body.dueDate !== undefined) changes.due_date = isoDate(body, 'dueDate');
      if (body.priority !== undefined) changes.priority = oneOf(body, 'priority', ['high', 'medium', 'low']);
    }
    if (Object.keys(changes).length === 0) throw badRequest('No changes supplied');
    changes.updated_at = nowIso();
    repo.update('tasks', task.id, changes);
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'task.update', target: task.id, metadata: changes });
    return formatTask(repo.get('tasks', task.id));
  });

  // ---- starter documents ----
  r.get('/api/documents/types', ({ ctx }) => { auth(ctx, 'org.read'); return Object.keys(DOC_TYPES); });

  r.post('/api/documents/generate', ({ ctx, body }) => {
    const repo = auth(ctx, 'document.generate');
    const type = oneOf(body, 'type', Object.keys(DOC_TYPES));
    const doc = generateDocument({ type, dpo: str(body, 'dpo', { required: false, max: 120 }), org: repo.organisation(),
      latest: latestAssessment(repo), controls: listControls(db), index });
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'document.generate', metadata: { type } });
    return doc;
  });

  // ---- audit trail (organisation-scoped) ----
  r.get('/api/audit', ({ ctx }) => {
    auth(ctx, 'audit.read');
    return db.prepare(`SELECT a.id, a.action, a.target, a.metadata_json, a.created_at, u.name AS user_name FROM audit_log a
                       LEFT JOIN users u ON u.id = a.user_id WHERE a.org_id = ? ORDER BY a.seq DESC LIMIT 300`).all(ctx.orgId)
      .map((a) => ({ id: a.id, action: a.action, target: a.target, metadata: JSON.parse(a.metadata_json), createdAt: a.created_at, user: a.user_name }));
  });

  r.get('/api/audit/verify', ({ ctx }) => { auth(ctx, 'audit.read'); return verifyAuditChain(db); });

  // Not a tenant route, but convenient for clients: send a 204-like empty ok.
  r.get('/api/health', ({ res }) => { sendJson(res, 200, { ok: true }); });
}
