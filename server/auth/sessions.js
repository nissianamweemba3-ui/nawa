// Session management. Session tokens are random, stored only as SHA-256 hashes, sent as HttpOnly,
// SameSite=Strict cookies, and expire. A session awaiting MFA grants no permissions.
import { randomToken, sha256 } from '../lib/crypto.js';
import { nowIso } from '../db.js';

export const COOKIE = 'zcip_sid';

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(db, config, { userId, orgId, mfaPending }) {
  const token = randomToken(32);
  db.prepare('INSERT INTO sessions (token_hash, user_id, org_id, mfa_pending, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sha256(token), userId, orgId, mfaPending ? 1 : 0, Date.now() + (mfaPending ? 10 * 60_000 : config.sessionTtlMs), nowIso());
  return token;
}

export function sessionCookie(config, token, maxAgeSec) {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${config.secureCookies ? '; Secure' : ''}`;
}

export function destroySession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function loadContext(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(sha256(token));
  if (!s) return null;
  if (s.expires_at < Date.now()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(s.token_hash); return null; }
  const user = db.prepare('SELECT id, email, name, platform_role, mfa_enabled FROM users WHERE id = ?').get(s.user_id);
  if (!user) return null;
  let orgRole = null;
  if (s.org_id && !s.mfa_pending) {
    orgRole = db.prepare('SELECT role FROM memberships WHERE user_id = ? AND org_id = ?').get(user.id, s.org_id)?.role ?? null;
  }
  return {
    token,
    tokenHash: s.token_hash,
    userId: user.id,
    email: user.email,
    name: user.name,
    mfaEnabled: Boolean(user.mfa_enabled),
    mfaPending: Boolean(s.mfa_pending),
    platformRole: s.mfa_pending ? 'user' : user.platform_role,
    orgId: orgRole ? s.org_id : null,
    orgRole,
  };
}
