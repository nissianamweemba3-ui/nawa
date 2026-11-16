# Architecture

```
Browser (web/, strict CSP)
   │  JSON over HTTPS, HttpOnly session cookie
   ▼
Node HTTP server (server/app.js)
   ├─ CSRF checks, body limits, router, errors
   ├─ Session + RBAC (server/auth)
   ├─ Tenant data via TenantRepo(org from session) ──► SQLite / PostgreSQL + RLS
   ├─ Deterministic scoring engine (source of truth)
   ├─ Encrypted evidence store (AES-256-GCM)
   ├─ Hash-chained audit log
   └─ Intelligence
        ├─ Copilot, Insights, Executive summary, Document intelligence, Regulatory workflow
        └─ AI Gateway ── permission → rate limit → injection scan → PII redaction
              │            → [approved sources (LegalIndex) + minimised org context]
              │            → Claude (structured JSON) or deterministic composer
              └──────────► validation (citations, over-claims, numbers) → AI log + audit
```

## Request flow: the assistant (§8 RAG workflow)

1. The session is verified and `ai.use` checked (identity and organisation permissions).
2. `LegalIndex.search` retrieves sections from approved, current versions only (relevant framework/topic). If a
   control is in focus, its mapped sources are added.
3. `minimisedOrgContext` builds the session organisation's context: sector, size band, role, flags,
   deterministic score and gaps, evidence status. No names, emails or file contents.
4. The gateway scans and redacts the question, then calls the model with sources wrapped as `<source id>` blocks
   and a JSON schema. With no sources, the model is not called.
5. Output validation keeps only citations to supplied sources and removes certification claims. An ungrounded
   answer becomes "insufficient sources".
6. The response returns the cited source texts, with pilot/unverified labels.
7. The interaction (redacted) and an audit entry are written.

## Knowledge base model (§9)

`kb_sources` (legal source) → `kb_versions` (version: dates, hash, status, current flag, reviewer) →
`kb_sections` (section/reference, verification flag). `kb_requirements` are atomic obligations with source
refs and applicability rules. `kb_controls` are the 15 MVP assessment questions, with plain language,
evidence expectations and review cycle. Review status is held on versions (four-eyes) and requirements.

## Deterministic vs AI

The score, risk band and gaps come only from `server/compliance/scoring.js`, a parity-tested port of the MVP. Insights and
priorities are rule-based with listed factors. A model may explain, summarise and annotate. It never sets a
score, clears a document gap, publishes law or creates a task without a person.
