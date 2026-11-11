// Legal knowledge base: sources, versions, sections, requirements, controls; ingestion and review workflow.
import { newId, sha256 } from '../lib/crypto.js';
import { nowIso, tx } from '../db.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { SOURCES, REQUIREMENTS, CONTROLS } from './seed-data.js';

export const SEED_REVIEWER = 'seed:pilot-baseline';

function contentHash(sections) {
  return sha256(JSON.stringify(sections.map((s) => [s.ref, s.heading, s.body])));
}

export function seedKnowledgeBase(db) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM kb_sources').get();
  if (existing.n > 0) return false;
  tx(db, () => {
    const now = nowIso();
    for (const src of SOURCES) {
      db.prepare('INSERT INTO kb_sources (id, title, issuer, source_type, url) VALUES (?, ?, ?, ?, ?)')
        .run(src.id, src.title, src.issuer, src.source_type, src.url);
      const sections = src.sections.map(([ref, heading, body]) => ({ ref, heading, body }));
      const versionId = newId();
      db.prepare(`INSERT INTO kb_versions (id, source_id, version_label, published_date, effective_date, content_sha256, status,
                  is_current, pilot_baseline, submitted_by, reviewed_by, reviewed_at, review_note, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, 'approved', 1, 1, ?, ?, ?, ?, ?)`)
        .run(versionId, src.id, src.version_label, src.published_date, null, contentHash(sections), SEED_REVIEWER,
          SEED_REVIEWER, now, 'Pilot baseline summaries. Requires verification by a qualified legal reviewer.', now);
      for (const s of sections) {
        db.prepare('INSERT INTO kb_sections (id, version_id, ref, heading, body, reference_verified) VALUES (?, ?, ?, ?, ?, 0)')
          .run(newId(), versionId, s.ref, s.heading, s.body);
      }
    }
    for (const [code, title, obligation, refs, applicability] of REQUIREMENTS) {
      db.prepare(`INSERT INTO kb_requirements (code, title, obligation, source_refs_json, applicability_json, review_status)
                  VALUES (?, ?, ?, ?, ?, 'approved')`)
        .run(code, title, obligation, JSON.stringify(refs.map(([source_id, ref]) => ({ source_id, ref }))), JSON.stringify(applicability));
    }
    CONTROLS.forEach(([id, req, question, priority, plain, evidence, cycle], i) => {
      db.prepare(`INSERT INTO kb_controls (id, requirement_code, question, priority, plain_language, evidence_json, review_cycle_days, sort_order)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, req, question, priority, plain, JSON.stringify(evidence), cycle, i);
    });
  });
  return true;
}

export function listControls(db) {
  return db.prepare(`SELECT c.*, r.title AS requirement_title, r.source_refs_json, r.applicability_json
                     FROM kb_controls c JOIN kb_requirements r ON r.code = c.requirement_code ORDER BY c.sort_order`).all()
    .map((c) => ({
      id: c.id, requirementCode: c.requirement_code, requirementTitle: c.requirement_title, question: c.question,
      priority: c.priority, plainLanguage: c.plain_language, evidence: JSON.parse(c.evidence_json),
      reviewCycleDays: c.review_cycle_days, sourceRefs: JSON.parse(c.source_refs_json), applicability: JSON.parse(c.applicability_json),
    }));
}

export function listRequirements(db) {
  return db.prepare('SELECT * FROM kb_requirements ORDER BY code').all().map((r) => ({
    code: r.code, title: r.title, obligation: r.obligation, sourceRefs: JSON.parse(r.source_refs_json),
    applicability: JSON.parse(r.applicability_json), reviewStatus: r.review_status,
  }));
}

export function listSources(db) {
  const sources = db.prepare('SELECT * FROM kb_sources ORDER BY source_type, title').all();
  const versions = db.prepare(`SELECT v.*, (SELECT COUNT(*) FROM kb_sections s WHERE s.version_id = v.id) AS section_count
                               FROM kb_versions v ORDER BY v.created_at DESC`).all();
  return sources.map((s) => ({
    ...s,
    versions: versions.filter((v) => v.source_id === s.id).map(formatVersion),
  }));
}

function formatVersion(v) {
  return {
    id: v.id, versionLabel: v.version_label, publishedDate: v.published_date, effectiveDate: v.effective_date,
    contentSha256: v.content_sha256, status: v.status, isCurrent: Boolean(v.is_current), pilotBaseline: Boolean(v.pilot_baseline),
    submittedBy: v.submitted_by, reviewedBy: v.reviewed_by, reviewedAt: v.reviewed_at, reviewNote: v.review_note,
    createdAt: v.created_at, sectionCount: v.section_count,
  };
}

export function getVersion(db, versionId) {
  const v = db.prepare(`SELECT v.*, (SELECT COUNT(*) FROM kb_sections s WHERE s.version_id = v.id) AS section_count
                        FROM kb_versions v WHERE v.id = ?`).get(versionId);
  if (!v) throw notFound('Version not found');
  const sections = db.prepare('SELECT id, ref, heading, body, reference_verified FROM kb_sections WHERE version_id = ? ORDER BY rowid').all(versionId);
  return { ...formatVersion(v), sourceId: v.source_id, sections };
}

export function currentVersion(db, sourceId) {
  return db.prepare("SELECT * FROM kb_versions WHERE source_id = ? AND is_current = 1 AND status = 'approved'").get(sourceId) ?? null;
}

export function sectionsOfVersion(db, versionId) {
  return db.prepare('SELECT ref, heading, body FROM kb_sections WHERE version_id = ? ORDER BY rowid').all(versionId);
}

function validateSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0 || sections.length > 500) throw badRequest('sections must be a non-empty array (max 500)');
  const refs = new Set();
  return sections.map((s, i) => {
    if (!s || typeof s !== 'object') throw badRequest(`sections[${i}] must be an object`);
    const ref = typeof s.ref === 'string' ? s.ref.trim() : '';
    const heading = typeof s.heading === 'string' ? s.heading.trim() : '';
    const body = typeof s.body === 'string' ? s.body.trim() : '';
    if (!ref || ref.length > 200) throw badRequest(`sections[${i}].ref is required (max 200 chars)`);
    if (!heading || heading.length > 300) throw badRequest(`sections[${i}].heading is required (max 300 chars)`);
    if (!body || body.length > 20_000) throw badRequest(`sections[${i}].body is required (max 20000 chars)`);
    if (refs.has(ref)) throw badRequest(`Duplicate section ref: ${ref}`);
    refs.add(ref);
    return { ref, heading, body, verified: s.referenceVerified === true };
  });
}

// Ingest a new version of a source. It enters 'pending_review' and is NOT retrievable by the AI until approved.
export function ingestVersion(db, { sourceId, versionLabel, publishedDate = null, effectiveDate = null, sections, submittedBy }) {
  if (!db.prepare('SELECT id FROM kb_sources WHERE id = ?').get(sourceId)) throw notFound('Source not found');
  const clean = validateSections(sections);
  const versionId = newId();
  tx(db, () => {
    db.prepare(`INSERT INTO kb_versions (id, source_id, version_label, published_date, effective_date, content_sha256, status,
                is_current, pilot_baseline, submitted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending_review', 0, 0, ?, ?)`)
      .run(versionId, sourceId, versionLabel, publishedDate, effectiveDate, contentHash(clean), submittedBy, nowIso());
    for (const s of clean) {
      db.prepare('INSERT INTO kb_sections (id, version_id, ref, heading, body, reference_verified) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId(), versionId, s.ref, s.heading, s.body, s.verified ? 1 : 0);
    }
  });
  return versionId;
}

export function createSource(db, { title, issuer, sourceType, url }) {
  const id = `src-${newId()}`;
  db.prepare('INSERT INTO kb_sources (id, title, issuer, source_type, url) VALUES (?, ?, ?, ?, ?)').run(id, title, issuer, sourceType, url);
  return id;
}

// Four-eyes review: the reviewer must be a different person from the submitter.
export function reviewVersion(db, { versionId, decision, reviewerId, note = null }) {
  const v = db.prepare('SELECT * FROM kb_versions WHERE id = ?').get(versionId);
  if (!v) throw notFound('Version not found');
  if (v.status !== 'pending_review') throw badRequest(`Version is already ${v.status}`);
  if (v.submitted_by === reviewerId) throw forbidden('A version must be reviewed by someone other than its submitter');
  tx(db, () => {
    const now = nowIso();
    if (decision === 'approve') {
      db.prepare("UPDATE kb_versions SET status = 'superseded', is_current = 0 WHERE source_id = ? AND is_current = 1").run(v.source_id);
      db.prepare("UPDATE kb_versions SET status = 'approved', is_current = 1, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?")
        .run(reviewerId, now, note, versionId);
    } else {
      db.prepare("UPDATE kb_versions SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?")
        .run(reviewerId, now, note, versionId);
    }
  });
  return { sourceId: v.source_id, status: decision === 'approve' ? 'approved' : 'rejected' };
}
