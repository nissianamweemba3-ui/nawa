// Regulatory Intelligence & change monitoring.
// 1 capture (paste or fetch from an allow-listed official host) → 2 timestamp + hash → 3 diff vs current approved
// version → 4 legal reviewer (≠ capturer) validates significance and affected requirements → 5 new approved KB
// version is published (merge of amendments) → 6 affected organisations mapped → 7 notifications created →
// 8 acknowledgement tracked. Nothing captured from the web becomes a requirement without human validation.
import { newId, sha256 } from '../lib/crypto.js';
import { nowIso, tx } from '../db.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { htmlToText } from '../lib/extract.js';
import { currentVersion, sectionsOfVersion, listRequirements, listControls } from '../kb/store.js';
import { scanForInjection } from '../ai/guards.js';

import { parseCapturedSections, diffSections, mergeSections, suggestRequirementsFrom } from './regdiff.js';

export { parseCapturedSections, diffSections, mergeSections } from './regdiff.js';

export function suggestRequirements(db, sourceId, diff) {
  return suggestRequirementsFrom(listRequirements(db), sourceId, diff);
}

export function captureChange(db, { sourceId, title, text, origin, capturedBy }) {
  const src = db.prepare('SELECT * FROM kb_sources WHERE id = ?').get(sourceId);
  if (!src) throw notFound('Source not found');
  const amendments = parseCapturedSections(text, title);
  if (amendments.length === 0) throw badRequest('No content could be parsed from the captured text');
  const base = currentVersion(db, sourceId);
  const baseSections = base ? sectionsOfVersion(db, base.id) : [];
  const diff = diffSections(baseSections, amendments);
  const scan = scanForInjection(text);
  const id = newId();
  db.prepare(`INSERT INTO reg_changes (id, source_id, title, origin, captured_text, captured_sha256, captured_at, captured_by, base_version_id,
              diff_json, suggested_requirements_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'detected')`)
    .run(id, sourceId, title, origin, text, sha256(text), nowIso(), capturedBy, base?.id ?? null,
      JSON.stringify({ ...diff, securityFlags: scan.hits }), JSON.stringify(suggestRequirements(db, sourceId, diff)));
  return id;
}

export async function fetchOfficialSource(url, allowedHosts, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { throw badRequest('Invalid URL'); }
  if (parsed.protocol !== 'https:') throw badRequest('Only https:// official sources may be fetched');
  if (!allowedHosts.includes(parsed.hostname)) throw badRequest(`Host ${parsed.hostname} is not on the official-source allow-list`);
  const res = await fetchImpl(parsed.toString(), { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw badRequest(`Source returned HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/text\/(html|plain)/i.test(type)) throw badRequest('Only HTML or plain-text sources can be captured automatically; paste other formats');
  const body = await res.text();
  if (body.length > 2_000_000) throw badRequest('Source document too large');
  return /html/i.test(type) ? htmlToText(body) : body;
}

export function getChange(db, id) {
  const c = db.prepare('SELECT * FROM reg_changes WHERE id = ?').get(id);
  if (!c) throw notFound('Change not found');
  return formatChange(c);
}

export function listChanges(db) {
  return db.prepare('SELECT * FROM reg_changes ORDER BY captured_at DESC').all().map(formatChange);
}

function formatChange(c) {
  return {
    id: c.id, sourceId: c.source_id, title: c.title, origin: c.origin, capturedAt: c.captured_at, capturedBy: c.captured_by,
    capturedSha256: c.captured_sha256, baseVersionId: c.base_version_id, diff: JSON.parse(c.diff_json),
    suggestedRequirements: JSON.parse(c.suggested_requirements_json), status: c.status, significance: c.significance,
    confirmedRequirements: c.confirmed_requirements_json ? JSON.parse(c.confirmed_requirements_json) : null,
    reviewerId: c.reviewer_id, reviewedAt: c.reviewed_at, reviewNote: c.review_note, newVersionId: c.new_version_id,
    capturedText: c.captured_text,
  };
}

function requirementApplies(req, org) {
  if (req.applicability.always) return true;
  if (req.applicability.orgFlag) return Boolean(org[req.applicability.orgFlag]);
  return true;
}

export function reviewChange(db, { changeId, reviewerId, decision, significance, requirementCodes = [], versionLabel, note = null }) {
  const c = db.prepare('SELECT * FROM reg_changes WHERE id = ?').get(changeId);
  if (!c) throw notFound('Change not found');
  if (c.status !== 'detected') throw badRequest(`Change already ${c.status}`);
  if (c.captured_by === reviewerId) throw forbidden('A change must be validated by someone other than the person who captured it');
  const now = nowIso();
  if (decision === 'reject') {
    db.prepare("UPDATE reg_changes SET status = 'rejected', reviewer_id = ?, reviewed_at = ?, review_note = ? WHERE id = ?")
      .run(reviewerId, now, note, changeId);
    return { status: 'rejected', notified: 0 };
  }
  const reqs = listRequirements(db);
  const known = new Set(reqs.map((r) => r.code));
  const codes = [...new Set(requirementCodes)];
  for (const code of codes) if (!known.has(code)) throw badRequest(`Unknown requirement code: ${code}`);
  const base = currentVersion(db, c.source_id);
  if ((base?.id ?? null) !== c.base_version_id) throw badRequest('The source has a newer approved version since capture; re-capture the change against it');
  const merged = mergeSections(base ? sectionsOfVersion(db, base.id) : [], parseCapturedSections(c.captured_text, c.title));
  if (merged.length === 0) throw badRequest('Publishing this change would leave the source with no sections');
  const controls = listControls(db);
  let notified = 0;
  const newVersionId = newId();
  tx(db, () => {
    db.prepare("UPDATE kb_versions SET status = 'superseded', is_current = 0 WHERE source_id = ? AND is_current = 1").run(c.source_id);
    db.prepare(`INSERT INTO kb_versions (id, source_id, version_label, published_date, effective_date, content_sha256, status, is_current,
                pilot_baseline, submitted_by, reviewed_by, reviewed_at, review_note, created_at)
                VALUES (?, ?, ?, ?, NULL, ?, 'approved', 1, 0, ?, ?, ?, ?, ?)`)
      .run(newVersionId, c.source_id, versionLabel || `Update: ${c.title}`, now.slice(0, 10),
        sha256(JSON.stringify(merged.map((s) => [s.ref, s.heading, s.body]))), c.captured_by, reviewerId, now, note, now);
    const baseVerified = base
      ? new Map(db.prepare('SELECT ref, body, reference_verified FROM kb_sections WHERE version_id = ?').all(base.id).map((s) => [s.ref, s]))
      : new Map();
    for (const s of merged) {
      const prev = baseVerified.get(s.ref);
      const verified = prev && prev.body === s.body ? prev.reference_verified : 0;
      db.prepare('INSERT INTO kb_sections (id, version_id, ref, heading, body, reference_verified) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId(), newVersionId, s.ref, s.heading, s.body, verified);
    }
    db.prepare(`UPDATE reg_changes SET status = 'validated', significance = ?, confirmed_requirements_json = ?, reviewer_id = ?, reviewed_at = ?,
                review_note = ?, new_version_id = ? WHERE id = ?`)
      .run(significance, JSON.stringify(codes), reviewerId, now, note, newVersionId, changeId);
    if (codes.length) {
      const orgs = db.prepare('SELECT * FROM organisations').all();
      for (const org of orgs) {
        const applicable = reqs.filter((r) => codes.includes(r.code) && requirementApplies(r, org)).map((r) => r.code);
        const affectedControls = controls.filter((ctl) => applicable.includes(ctl.requirementCode)).map((ctl) => ctl.id);
        if (affectedControls.length === 0) continue;
        db.prepare(`INSERT INTO reg_notifications (id, change_id, org_id, affected_controls_json, status, created_at)
                    VALUES (?, ?, ?, ?, 'open', ?)`).run(newId(), changeId, org.id, JSON.stringify(affectedControls), now);
        notified += 1;
      }
    }
  });
  return { status: 'validated', newVersionId, notified };
}
