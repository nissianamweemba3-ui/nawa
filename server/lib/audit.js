// Append-only, hash-chained audit log. Each entry's hash covers its content and the previous entry's hash,
// so any edit or deletion of a historical row is detectable with verifyAuditChain().
import { newId, sha256 } from './crypto.js';
import { nowIso } from '../db.js';

const GENESIS = '0'.repeat(64);

function entryHash(e) {
  return sha256([e.id, e.org_id ?? '', e.user_id ?? '', e.action, e.target ?? '', e.metadata_json, e.prev_hash, e.created_at].join('|'));
}

export function audit(db, { orgId = null, userId = null, action, target = null, metadata = {} }) {
  const last = db.prepare('SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1').get();
  const e = {
    id: newId(), org_id: orgId, user_id: userId, action, target,
    metadata_json: JSON.stringify(metadata), prev_hash: last ? last.hash : GENESIS, created_at: nowIso(),
  };
  e.hash = entryHash(e);
  db.prepare(`INSERT INTO audit_log (id, org_id, user_id, action, target, metadata_json, prev_hash, hash, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(e.id, e.org_id, e.user_id, e.action, e.target, e.metadata_json, e.prev_hash, e.hash, e.created_at);
  return e;
}

export function verifyAuditChain(db) {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY seq ASC').all();
  let prev = GENESIS;
  for (const row of rows) {
    if (row.prev_hash !== prev) return { valid: false, brokenAt: row.id, reason: 'prev_hash mismatch' };
    if (entryHash(row) !== row.hash) return { valid: false, brokenAt: row.id, reason: 'content hash mismatch' };
    prev = row.hash;
  }
  return { valid: true, entries: rows.length };
}
