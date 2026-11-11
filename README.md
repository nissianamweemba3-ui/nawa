# DPA Zambia — Compliance Intelligence Platform

Zambia data-protection compliance platform, built on the original **DPA Zambia MVP** (preserved unchanged in
[`legacy/mvp/`](legacy/mvp/)) and taken through the secure foundation the *Phase Three: AI Intelligence*
document requires (Phase One/Two) up to the Phase Three intelligence layer.

> Guidance tool. It does not submit anything to the Data Protection Commission, does not certify compliance and
> does not replace legal advice. The legal knowledge base ships as a **pilot baseline of paraphrased summaries
> with unverified references**. A qualified legal reviewer must verify them before production use (see
> [docs/PHASE3_READINESS.md](docs/PHASE3_READINESS.md)).

## Quick start

Requires Node.js 22.5+ (uses the built-in `node:sqlite`). No build step.

```bash
npm install
```

```bash
npm run seed:demo
```

```bash
npm start
```

Open http://127.0.0.1:3000 and sign in with an account printed by `seed:demo`. The demo creates two separate
organisations (Acme Retail, ZedHealth), a platform admin and a legal reviewer, so you can exercise tenant
isolation, four-eyes review and the regulatory workflow. Or register your own organisation from the sign-in page.

```bash
npm test
```

Runs 76 tests: scoring parity with the MVP, auth/MFA/RBAC, CSRF, tenant isolation (including AI context),
AI threat tests, retrieval accuracy, KB and regulatory governance, document intelligence and the Claude provider.

### Enabling the model

Without credentials every AI feature runs in **deterministic mode**: answers quote the approved sources, with
citations. To generate answers with Claude, set `ANTHROPIC_API_KEY` on the server (never in the browser):

```bash
ANTHROPIC_API_KEY=... npm start
```

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `anthropic` if a key is set, else `offline` | Force a provider |
| `AI_MODEL` / `AI_EFFORT` | `claude-opus-5-5` / `medium` | Model and effort level |
| `AI_FALLBACKS` | on | Server-side refusal fallback (`off` to disable) |
| `AI_RATE_LIMIT_PER_MINUTE` | `20` | Per-user AI request limit |
| `DATA_KEY` | generated per data dir | 64 hex chars; AES-256-GCM key for evidence and MFA secrets. **Set this in production.** |
| `DATA_DIR`, `PORT`, `HOST` | `./data`, `3000`, `127.0.0.1` | Storage and listener |
| `SECURE_COOKIES` | `false` | Set `true` behind HTTPS |
| `OFFICIAL_SOURCE_HOSTS` | DPC, Parliament, ZambiaLII | Allow-list for regulatory fetches |

## What was built

| Area | MVP (kept) | Foundation added (Phase One/Two) | Intelligence added (Phase Three) |
|---|---|---|---|
| Organisation | Profile form | Multi-tenant orgs, memberships, 5 roles, org switching | Profile flags drive contextual prioritisation |
| Assessment | 15 questions | Questions served from the requirements database; history | Compliance Copilot per question |
| Scoring | Weighted score | Same engine, server-side, versioned and explainable (parity-tested) | Trend, pattern and priority insights; never changes the score |
| Gaps | Gap list | Remediation tasks with owners, due dates, status | Explainable, factor-based prioritisation |
| Legal sources | Static list | Versioned KB: sources → versions → sections → requirements → controls, with four-eyes review | RAG retrieval over approved, current versions only |
| Documents | Starter generator | Encrypted, versioned evidence store | Document intelligence against approved checklists, with human review → tasks |
| Storage | `localStorage` | SQLite here; PostgreSQL + RLS schema in `db/postgres/` | AI interaction log (redacted) |
| Security | none | scrypt passwords, TOTP MFA, HttpOnly/SameSite sessions, RBAC, CSRF defences, strict CSP, hash-chained audit log | AI gateway: injection detection, PII redaction, untrusted-content fencing, citation verification, over-claim removal, rate limits |
| Regulatory | — | Source version workflow | Capture → diff → reviewer validation → new version → applicability-aware notifications → acknowledgement |
| Reporting | Dashboard | Dashboard, audit log | Executive summary (numbers verified against platform facts) |

## Layout

```
server/            Node HTTP server (no framework)
  ai/              gateway, guards, providers (Claude / offline), assistant
  intel/           copilot, insights + executive, document intelligence, regulatory
  kb/              seed data, store (versioning/review), BM25 retrieval
  compliance/      deterministic scoring, state/read models, document generator
  routes/          auth, compliance, intelligence, governance
web/               single-page client (vanilla JS, strict CSP)
db/postgres/       production schema with Row Level Security
docs/              readiness assessment, architecture & security, residual risks
legacy/mvp/        the original MVP, unchanged
tests/             node:test suites
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).
