// SQLite persistence (node:sqlite) mirroring the production PostgreSQL schema in db/postgres/schema.sql.
// Tenant isolation is enforced in the application by server/tenancy.js (every tenant table carries org_id)
// and, in PostgreSQL, additionally by Row Level Security policies.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'Not specified',
  employees INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'Data Controller',
  processes_sensitive INTEGER NOT NULL DEFAULT 0,
  transfers_abroad INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  mfa_secret_enc TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  platform_role TEXT NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user','legal_reviewer','platform_admin')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT NOT NULL REFERENCES organisations(id),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','compliance_officer','contributor','viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  org_id TEXT REFERENCES organisations(id),
  mfa_pending INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  answers_json TEXT NOT NULL,
  score INTEGER NOT NULL,
  risk TEXT NOT NULL,
  gaps_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(org_id, created_at);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  control_id TEXT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes TEXT,
  valid_until TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON evidence(org_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  control_id TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  due_date TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual','assessment','copilot','document_ai','regulatory','insight')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(org_id);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  org_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ---------- Legal knowledge base (platform-wide, not tenant data) ----------
CREATE TABLE IF NOT EXISTS kb_sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('act','regulation','guidance')),
  url TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'ZM'
);

CREATE TABLE IF NOT EXISTS kb_versions (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES kb_sources(id),
  version_label TEXT NOT NULL,
  published_date TEXT,
  effective_date TEXT,
  content_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review','approved','superseded','rejected')),
  is_current INTEGER NOT NULL DEFAULT 0,
  pilot_baseline INTEGER NOT NULL DEFAULT 0,
  submitted_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kb_versions_source ON kb_versions(source_id);

CREATE TABLE IF NOT EXISTS kb_sections (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES kb_versions(id),
  ref TEXT NOT NULL,
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_verified INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_kb_sections_version ON kb_sections(version_id);

CREATE TABLE IF NOT EXISTS kb_requirements (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  obligation TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  applicability_json TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending_review','approved'))
);

CREATE TABLE IF NOT EXISTS kb_controls (
  id TEXT PRIMARY KEY,
  requirement_code TEXT NOT NULL REFERENCES kb_requirements(code),
  question TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  plain_language TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  review_cycle_days INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);

-- ---------- Regulatory intelligence ----------
CREATE TABLE IF NOT EXISTS reg_changes (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES kb_sources(id),
  title TEXT NOT NULL,
  origin TEXT NOT NULL,
  captured_text TEXT NOT NULL,
  captured_sha256 TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  captured_by TEXT NOT NULL REFERENCES users(id),
  base_version_id TEXT REFERENCES kb_versions(id),
  diff_json TEXT NOT NULL,
  suggested_requirements_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('detected','validated','rejected')),
  significance TEXT,
  confirmed_requirements_json TEXT,
  reviewer_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  new_version_id TEXT REFERENCES kb_versions(id)
);

CREATE TABLE IF NOT EXISTS reg_notifications (
  id TEXT PRIMARY KEY,
  change_id TEXT NOT NULL REFERENCES reg_changes(id),
  org_id TEXT NOT NULL REFERENCES organisations(id),
  affected_controls_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','acknowledged')),
  acknowledged_by TEXT REFERENCES users(id),
  acknowledged_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reg_notifications_org ON reg_notifications(org_id);

-- ---------- Document intelligence ----------
CREATE TABLE IF NOT EXISTS doc_analyses (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  checklist TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  security_flags_json TEXT NOT NULL,
  ai_used INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_analyses_org ON doc_analyses(org_id);

-- ---------- AI interaction log (metadata only; questions stored redacted) ----------
CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organisations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  input_redacted TEXT NOT NULL,
  retrieved_json TEXT NOT NULL,
  cited_json TEXT NOT NULL,
  provider TEXT NOT NULL,
  outcome TEXT NOT NULL,
  flags_json TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_org ON ai_interactions(org_id);
`;

export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

export const nowIso = () => new Date().toISOString();

// Runs fn inside a transaction; rolls back on any thrown error.
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
