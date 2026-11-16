-- Zambia Compliance Intelligence Platform — production PostgreSQL schema with Row Level Security.
--
-- The application connects as role `zcip_app` (NOT the table owner) and, at the start of every
-- transaction that touches tenant data, runs:
--     SET LOCAL app.current_org = '<organisation uuid from the authenticated session>';
-- RLS then filters every tenant table to that organisation, as a second layer beneath the
-- application's TenantRepo. If app.current_org is unset, tenant queries return no rows.
--
-- Status: this file mirrors server/db.js (SQLite, used for local runs and the test suite).
-- It has not yet been executed by the automated tests; run the cross-tenant RLS checks at the end of
-- this file against a staging database before go-live.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zcip_app') THEN
    CREATE ROLE zcip_app LOGIN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION current_org() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.current_org', true), '')::uuid $$;

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sector text NOT NULL DEFAULT 'Not specified',
  employees integer NOT NULL DEFAULT 0 CHECK (employees >= 0),
  role text NOT NULL DEFAULT 'Data Controller',
  processes_sensitive boolean NOT NULL DEFAULT false,
  transfers_abroad boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  mfa_secret_enc text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  platform_role text NOT NULL DEFAULT 'user' CHECK (platform_role IN ('user','legal_reviewer','platform_admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id),
  org_id uuid NOT NULL REFERENCES organisations(id),
  role text NOT NULL CHECK (role IN ('owner','admin','compliance_officer','contributor','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  org_id uuid REFERENCES organisations(id),
  mfa_pending boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  answers jsonb NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk text NOT NULL CHECK (risk IN ('Low','Medium','High')),
  gaps jsonb NOT NULL,
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON assessments (org_id, created_at);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  control_id text,
  title text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  sha256 text NOT NULL,
  storage_key uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes uuid REFERENCES evidence(id),
  valid_until date,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON evidence (org_id);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  control_id text,
  priority text NOT NULL CHECK (priority IN ('high','medium','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  due_date date,
  source text NOT NULL CHECK (source IN ('manual','assessment','copilot','document_ai','regulatory','insight')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON tasks (org_id);

CREATE TABLE audit_log (
  seq bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  org_id uuid,
  user_id uuid,
  action text NOT NULL,
  target text,
  metadata jsonb NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Legal knowledge base (platform-wide reference data; read-only to the application role except via governance flows)
CREATE TABLE kb_sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  issuer text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('act','regulation','guidance')),
  url text,
  jurisdiction text NOT NULL DEFAULT 'ZM'
);

CREATE TABLE kb_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES kb_sources(id),
  version_label text NOT NULL,
  published_date date,
  effective_date date,
  content_sha256 text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_review','approved','superseded','rejected')),
  is_current boolean NOT NULL DEFAULT false,
  pilot_baseline boolean NOT NULL DEFAULT false,
  submitted_by text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'approved' OR reviewed_by IS DISTINCT FROM submitted_by)  -- four-eyes
);
CREATE UNIQUE INDEX one_current_version_per_source ON kb_versions (source_id) WHERE is_current;

CREATE TABLE kb_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES kb_versions(id),
  ref text NOT NULL,
  heading text NOT NULL,
  body text NOT NULL,
  reference_verified boolean NOT NULL DEFAULT false,
  UNIQUE (version_id, ref)
);

CREATE TABLE kb_requirements (
  code text PRIMARY KEY,
  title text NOT NULL,
  obligation text NOT NULL,
  source_refs jsonb NOT NULL,
  applicability jsonb NOT NULL,
  review_status text NOT NULL CHECK (review_status IN ('pending_review','approved'))
);

CREATE TABLE kb_controls (
  id text PRIMARY KEY,
  requirement_code text NOT NULL REFERENCES kb_requirements(code),
  question text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('high','medium','low')),
  plain_language text NOT NULL,
  evidence jsonb NOT NULL,
  review_cycle_days integer NOT NULL,
  sort_order integer NOT NULL
);

CREATE TABLE reg_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES kb_sources(id),
  title text NOT NULL,
  origin text NOT NULL,
  captured_text text NOT NULL,
  captured_sha256 text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by uuid NOT NULL REFERENCES users(id),
  base_version_id uuid REFERENCES kb_versions(id),
  diff jsonb NOT NULL,
  suggested_requirements jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('detected','validated','rejected')),
  significance text CHECK (significance IN ('low','medium','high')),
  confirmed_requirements jsonb,
  reviewer_id uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_note text,
  new_version_id uuid REFERENCES kb_versions(id),
  CHECK (reviewer_id IS NULL OR reviewer_id <> captured_by)  -- four-eyes
);

CREATE TABLE reg_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid NOT NULL REFERENCES reg_changes(id),
  org_id uuid NOT NULL REFERENCES organisations(id),
  affected_controls jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('open','acknowledged')),
  acknowledged_by uuid REFERENCES users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON reg_notifications (org_id);

CREATE TABLE doc_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  evidence_id uuid NOT NULL REFERENCES evidence(id),
  checklist text NOT NULL,
  findings jsonb NOT NULL,
  security_flags jsonb NOT NULL,
  ai_used boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON doc_analyses (org_id);

CREATE TABLE ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL,
  input_redacted text NOT NULL,
  retrieved jsonb NOT NULL,
  cited jsonb NOT NULL,
  provider text NOT NULL,
  outcome text NOT NULL,
  flags jsonb NOT NULL,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_interactions (org_id);

-- ---------------- Row Level Security on every tenant table ----------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assessments','evidence','tasks','doc_analyses','reg_notifications','ai_interactions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (org_id = current_org()) WITH CHECK (org_id = current_org())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO zcip_app', t);
  END LOOP;
END $$;

-- Organisations: the app may read/update only the current organisation; creation happens via a
-- SECURITY DEFINER function owned by a privileged role (not shown) during registration.
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_self ON organisations USING (id = current_org()) WITH CHECK (id = current_org());
GRANT SELECT, UPDATE ON organisations TO zcip_app;

-- Regulatory fan-out (reviewChange in server/intel/regulatory.js) reads all organisations and inserts
-- reg_notifications for each. Under RLS this must run as a separate governance service role or a
-- SECURITY DEFINER function that only inserts notification rows; the tenant-facing role cannot do it.

-- Audit log is append-only for the application role.
REVOKE ALL ON audit_log FROM zcip_app;
GRANT SELECT, INSERT ON audit_log TO zcip_app;
GRANT USAGE ON SEQUENCE audit_log_seq_seq TO zcip_app;

-- Knowledge base: readable by the app; writes only through governance flows.
GRANT SELECT ON kb_sources, kb_versions, kb_sections, kb_requirements, kb_controls TO zcip_app;
GRANT INSERT, UPDATE ON kb_sources, kb_versions, kb_sections, reg_changes TO zcip_app;
GRANT SELECT ON reg_changes TO zcip_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, memberships, sessions TO zcip_app;

-- ---------------- Cross-tenant RLS checks (run in staging as zcip_app) ----------------
-- BEGIN; SET LOCAL app.current_org = '<org A>'; SELECT count(*) FROM evidence WHERE org_id = '<org B>'; -- expect 0
-- BEGIN; SET LOCAL app.current_org = '<org A>'; INSERT INTO tasks (org_id, ...) VALUES ('<org B>', ...);  -- expect RLS violation
-- BEGIN; RESET app.current_org; SELECT count(*) FROM tasks;                                              -- expect 0
