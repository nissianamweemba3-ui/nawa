# Security, AI Threat Model and Residual Risks

## Controls

**Platform**
- Passwords: scrypt (N=16384) with per-user salt and timing-safe comparison. Unknown-user logins do equal work.
- MFA: RFC 6238 TOTP. The secret is encrypted at rest. A session awaiting MFA has no permissions.
- Sessions: 256-bit random tokens, stored only as SHA-256. Cookies are `HttpOnly; SameSite=Strict` (`Secure` when enabled) and expire.
- CSRF: SameSite=Strict, JSON-only bodies (`415` otherwise) and same-origin `Origin` check.
- Browser: strict CSP (`script-src 'self'`, no inline script or style), `X-Frame-Options: DENY`, `nosniff`,
  `no-referrer`. All rendered values are escaped.
- RBAC: owner, admin, compliance_officer, contributor, viewer. Platform roles (legal_reviewer, platform_admin)
  grant governance only, never tenant data, and cannot be self-assigned.
- Tenant isolation: `TenantRepo` forces `org_id` from the session on every read and write. PostgreSQL RLS adds a second layer.
- Evidence: AES-256-GCM, opaque storage keys, sanitised filenames, magic-byte checks, size limit, `attachment` downloads.
- Audit: hash-chained, append-only log, with verification endpoint and UI.
- Rate limits: login (per IP + email), registration (per IP), MFA attempts, AI requests (per user).

**AI layer (all in the gateway)**
- The model never touches the database. Context is assembled server-side from the session organisation only.
- Data minimisation: emails, Zambian NRC, phone and card/account numbers are redacted. Organisation names,
  user identities and evidence contents are excluded from assistant context.
- Prompt-injection scanning on user input (high severity is blocked) and on documents (flagged, still treated as data).
- Untrusted content is fenced in `<untrusted_document>`, and fence tokens inside it are neutralised.
- Structured output (JSON schema) and validation: citations must be ids of retrieved sources, inline markers are
  checked, certification/guarantee claims are removed, and uncited answers become "insufficient sources".
- No sources retrieved means no model call: a safe uncertainty answer is returned instead.
- Document findings: the model may raise concerns but cannot clear a gap that the rules detected.
- Executive narratives: every number must appear in the platform facts, otherwise the deterministic narrative is used.
- High-impact actions (publishing law, notifying organisations, creating tasks from findings) always need a person.
- Every AI call is logged with a redacted input, retrieved/cited ids, provider, outcome, flags and latency, and audited.

## Threat → test map (Phase Three §16)

| Threat | Test |
|---|---|
| Prompt injection | `ai-security`: detector cases; high-severity input blocked before the model |
| Cross-tenant leakage | `tenant-isolation`: IDOR on every object type, list endpoints, body `org_id` injection, canary absent from prompt |
| Data exfiltration | `tenant-isolation`: "other organisations' records" prompt blocked; PII redacted from prompts |
| Hallucination | `ai-security`: tax question → no sources, no model call, uncertainty answer |
| Citation fabrication | `ai-security`: fake ids removed, answer downgraded; inline markers verified |
| Malicious documents | `ai-security`: hidden HTML instructions flagged, fenced, PII redacted; compromised model cannot clear gaps |
| Retrieval poisoning | `ai-security` + `governance`: unapproved versions are never retrievable; four-eyes on KB and regulatory changes; stale captures refused |
| Jailbreaking | `ai-security`: persona/bypass patterns blocked |
| Over-claiming | `ai-security`: "fully compliant" removed |
| Provider failure / refusal | `ai-security` + `provider`: fallback to deterministic composer; refusal, truncation and invalid JSON handled |

## Residual risks

1. **Legal content accuracy.** The seeded KB is paraphrased and its references are unverified. This is the largest
   risk, and the reason every surface labels it. Production requires legal verification.
2. **Lexical retrieval.** BM25 with a domain vocabulary can miss paraphrased questions, or match
   off-domain questions that share a word (for example "mining licence" matches data-protection licensing). The
   model is instructed to say when sources don't answer the question. An embedding index behind the same
   interface would improve recall.
3. **Pattern-based injection detection** can be evaded by novel phrasing. It is one layer: fencing, system rules,
   output validation and the rule that models cannot clear gaps still apply.
4. **Redaction** covers common identifier formats only. Free-text names and addresses in questions or documents can still reach the model.
5. **SQLite in this repository** relies on application-layer isolation only. The RLS schema has not yet been run in CI.
6. **In-memory rate limits** reset on restart and are per process. Use a shared store when scaling out.
7. **Live-model behaviour** is tested through a recording mock and a stub client. No live evaluation has run
   (no key in the build environment).
8. **Development data key.** Without `DATA_KEY`, a key file is created in the data directory. Production must use a secret manager.
9. **Regulatory fetch** accepts only allow-listed https hosts and refuses redirects. Fetched content is still untrusted and always goes to human review.
