# Phase Three Readiness Assessment & Gap Analysis

This is the assessment that the Phase Three document (§25) asks for, written against the code in this repository.

## A. What already existed (the MVP)

A single browser page (`legacy/mvp/index.html`) with an organisation profile, the 15-question assessment,
weighted scoring (high 3 / medium 2 / low 1; Yes = full, Partially = half), High/Medium/Low risk bands, a gap list,
a starter document generator and a static legal source register. All data lived in `localStorage`, with no users,
server or AI.

## B. Phase One/Two foundation: delivered here

| Prerequisite (§4) | Status | Where |
|---|---|---|
| Multi-tenant architecture | Done: every tenant row has `org_id`; all access goes through `TenantRepo`, bound to the session org | `server/tenancy.js` |
| Row Level Security + cross-tenant testing | App layer done and tested. PostgreSQL RLS policies written but **not yet executed in CI** | `db/postgres/schema.sql`, `tests/tenant-isolation.test.js` |
| Authentication and role-based permissions | Done: scrypt, TOTP MFA, 5 org roles + 2 platform roles | `server/auth/*`, `server/routes/auth.js` |
| Audit logging | Done: append-only, hash-chained, verifiable | `server/lib/audit.js` |
| Secure document storage | Done: AES-256-GCM at rest, opaque keys, per-org directories, versioning | `server/lib/storage.js` |
| Compliance requirements database | Done: 15 requirements → 15 controls, evidence expectations, applicability | `server/kb/seed-data.js` |
| Legal source register and version control | Done: versions, hashes, current/superseded, four-eyes review | `server/kb/store.js` |
| Evidence management | Done: control linking, validity dates, freshness | `server/compliance/state.js` |
| Staging and pilot testing | Partial: 76 automated tests and a scripted browser check. No staging environment yet | `tests/` |
| Production monitoring and incident response | Not done: an audit log and an AI interaction log exist, but no external monitoring or alerting | — |

## C. What Phase Three adds (the 12 build items in §25)

| # | Item | Implementation |
|---|---|---|
| 1 | Legal KB ingestion & versioning | `POST /api/kb/sources/:id/versions` → `pending_review` → independent reviewer approves → becomes current |
| 2 | Secure RAG retrieval | `LegalIndex`: BM25 over **approved, current** sections only, with domain vocabulary and coverage + score thresholds |
| 3 | Tenant-aware permission filtering | Gateway requires `ai.use`. Context is built only through `TenantRepo(ctx.orgId)` and minimised (`minimisedOrgContext`) |
| 4 | AI gateway | `server/ai/gateway.js`: permission → rate limit → injection scan → PII redaction → model or deterministic composer → validation → audit |
| 5 | AI Compliance Assistant | `server/ai/assistant.js`, `POST /api/assistant/ask` |
| 6 | Citations & grounding controls | Citations must be ids of retrieved sources. Fabricated ones are removed, uncited answers are downgraded to "insufficient sources", and a lexical grounding signal is recorded |
| 7 | Prompt-injection defences | Pattern scanner (blocks high severity), fenced `<untrusted_document>` content, system rules, document findings the model cannot clear |
| 8 | AI data-leakage protection | Redaction of emails, NRC, phone and card numbers. No names, emails, file contents or org names in context. Server-side keys only |
| 9 | Document intelligence pilot | `server/intel/documents.js`: rule-based checklist is primary, model adds notes, human accepts or dismisses each finding → task |
| 10 | Regulatory intelligence workflow | `server/intel/regulatory.js`: capture (paste / allow-listed https fetch) → hash → diff → reviewer ≠ capturer → merged new version → notifications by applicability → acknowledgement + tasks |
| 11 | AI-assisted compliance insights | `server/intel/insights.js`: claimed-without-evidence, expired/stale evidence, policy-without-training, recurring gaps, overdue tasks, regulatory change, applicability gaps, with factor-explained priorities |
| 12 | Executive summaries & trends | Score trend, deterministic narrative; a model rewrite is accepted only if every number appears in the platform facts |

Compliance Copilot (§14) is `server/intel/copilot.js`.

## D. Dependencies

- Node.js ≥ 22.5 (`node:sqlite`), one npm dependency: `@anthropic-ai/sdk`.
- Optional: `ANTHROPIC_API_KEY` for model generation (otherwise deterministic mode).
- Production: PostgreSQL 14+ with the RLS schema, a managed secret store for `DATA_KEY`, HTTPS termination,
  object storage for evidence, and a qualified legal reviewer for the knowledge base.

## E. Security risks

See [SECURITY.md](SECURITY.md) for the threat model, the test that covers each threat, and residual risks.

## F. Development sequence: what is done and what is next

Done in this repository: steps 1–13 of §18, in pilot form.

Before a production pilot:
1. **Legal verification** of every knowledge-base section and reference by a qualified reviewer (replace the pilot baseline).
2. Move to PostgreSQL. Run the RLS cross-tenant checks in staging, and move the regulatory fan-out to a governance service role.
3. Set `DATA_KEY` from a secret manager and enable `SECURE_COOKIES` behind HTTPS.
4. Live-model evaluation: run the assistant against the retrieval and grounding test set with a key, compare
   document-intelligence findings with human review (§19), and run a red-team exercise.
5. External monitoring and alerting on `ai.blocked`, `provider_fallback`, `fabricated_citation_removed` and auth failures.
6. Collect pilot feedback (§21 use cases) and expand from validated use cases only.

## Exit criteria (§24): status

| Criterion | Status |
|---|---|
| Approved legal knowledge base operational | Mechanism done. Content is a pilot baseline **pending legal verification** |
| Source versioning and traceability | Done (hashes, versions, reviewer, timestamps) |
| AI responses are permission-aware | Done and tested |
| Cross-tenant AI leakage testing passes | Passes (canary test on the prompt) |
| Prompt-injection testing completed | Automated tests pass. A human red-team exercise is still needed |
| Unsupported questions don't produce confident fabrications | Done and tested (no model call without sources; ungrounded answers downgraded) |
| Citations verifiable | Done: only ids of supplied sources survive |
| Document intelligence compared with human review | Not yet: needs pilot data |
| AI security monitoring operational | Partial: logged and audited, no alerting |
| Human oversight for high-impact workflows | Done: KB approval, regulatory validation, finding review and task creation all need a person |
| Pilot users validated value | Not yet |
