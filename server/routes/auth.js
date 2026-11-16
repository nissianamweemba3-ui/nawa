// Authentication, MFA, organisation switching and membership management.
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH, newId, encrypt, decrypt, generateTotpSecret, verifyTotp } from '../lib/crypto.js';
import { nowIso, tx } from '../db.js';
import { audit } from '../lib/audit.js';
import { badRequest, unauthorized, forbidden, notFound, tooMany, str, oneOf, reply } from '../lib/http.js';
import { createSession, destroySession, sessionCookie } from '../auth/sessions.js';
import { ORG_ROLES, ORG_ROLE_PERMISSIONS, PLATFORM_ROLE_PERMISSIONS, requireOrgPermission } from '../auth/rbac.js';

export const ORG_ENTITY_ROLES = ['Data Controller', 'Data Processor', 'Controller and Processor'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function requireAuth(ctx) {
  if (!ctx) throw unauthorized();
  if (ctx.mfaPending) throw unauthorized('MFA verification required');
  return ctx;
}

export function readOrgFields(body, { partial = false } = {}) {
  const out = {};
  const name = str(body, 'name', { required: !partial, max: 200, min: 2 });
  if (name !== null) out.name = name;
  const sector = str(body, 'sector', { required: false, max: 100 });
  if (sector !== null) out.sector = sector;
  if (body.employees !== undefined && body.employees !== null && body.employees !== '') {
    const n = Number(body.employees);
    if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw badRequest("'employees' must be a non-negative integer");
    out.employees = n;
  }
  const role = oneOf(body, 'role', ORG_ENTITY_ROLES, { required: false });
  if (role !== null) out.role = role;
  for (const flag of ['processes_sensitive', 'transfers_abroad']) {
    if (body[flag] !== undefined) {
      if (typeof body[flag] !== 'boolean') throw badRequest(`'${flag}' must be true or false`);
      out[flag] = body[flag] ? 1 : 0;
    }
  }
  return out;
}

export function createOrganisation(db, userId, fields) {
  const id = newId();
  tx(db, () => {
    db.prepare(`INSERT INTO organisations (id, name, sector, employees, role, processes_sensitive, transfers_abroad, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, fields.name, fields.sector ?? 'Not specified', fields.employees ?? 0, fields.role ?? 'Data Controller',
        fields.processes_sensitive ?? 0, fields.transfers_abroad ?? 0, nowIso());
    db.prepare("INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(userId, id, nowIso());
  });
  return id;
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 12 || pw.length > 200) throw badRequest('Password must be 12–200 characters');
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) throw badRequest('Password must contain letters and numbers');
}

function meResponse(db, ctx) {
  const memberships = db.prepare(`SELECT o.id, o.name, m.role FROM memberships m JOIN organisations o ON o.id = m.org_id
                                  WHERE m.user_id = ? ORDER BY o.name`).all(ctx.userId);
  const perms = new Set([...(ctx.orgRole ? ORG_ROLE_PERMISSIONS[ctx.orgRole] : []), ...(PLATFORM_ROLE_PERMISSIONS[ctx.platformRole] ?? [])]);
  return {
    user: { id: ctx.userId, email: ctx.email, name: ctx.name, platformRole: ctx.platformRole, mfaEnabled: ctx.mfaEnabled },
    activeOrg: ctx.orgId ? memberships.find((m) => m.id === ctx.orgId) : null,
    memberships,
    permissions: [...perms].sort(),
  };
}

export function registerAuthRoutes(r, svc) {
  const { db, config, dataKey } = svc;
  const ttlSec = Math.floor(config.sessionTtlMs / 1000);

  r.post('/api/auth/register', ({ body, req }) => {
    const email = str(body, 'email', { max: 254 }).toLowerCase();
    if (!EMAIL.test(email)) throw badRequest('Invalid email address');
    const name = str(body, 'name', { max: 120, min: 2 });
    validatePassword(body.password);
    const orgFields = readOrgFields(body.organisation ?? {});
    if (!svc.registerLimiter.check(`register:${req.socket.remoteAddress}`)) throw tooMany();
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw badRequest('An account with this email already exists');
    const userId = newId();
    db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, email, name, hashPassword(body.password), nowIso());
    const orgId = createOrganisation(db, userId, orgFields);
    audit(db, { orgId, userId, action: 'auth.register', target: userId });
    audit(db, { orgId, userId, action: 'org.create', target: orgId, metadata: { name: orgFields.name } });
    const token = createSession(db, config, { userId, orgId, mfaPending: false });
    return reply(201, { ok: true }, { 'Set-Cookie': sessionCookie(config, token, ttlSec) });
  });

  r.post('/api/auth/login', ({ body, req }) => {
    const email = str(body, 'email', { max: 254 }).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!svc.loginLimiter.check(`login:${req.socket.remoteAddress}:${email}`)) throw tooMany('Too many login attempts. Try again in a minute.');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH) && Boolean(user);
    if (!ok) {
      audit(db, { userId: user?.id ?? null, action: 'auth.login_failed', metadata: { email } });
      throw unauthorized('Invalid email or password');
    }
    const firstOrg = db.prepare('SELECT org_id FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1').get(user.id);
    const mfaPending = Boolean(user.mfa_enabled);
    const token = createSession(db, config, { userId: user.id, orgId: firstOrg?.org_id ?? null, mfaPending });
    audit(db, { orgId: firstOrg?.org_id ?? null, userId: user.id, action: mfaPending ? 'auth.login_password_ok' : 'auth.login' });
    return reply(200, { ok: true, mfaRequired: mfaPending }, { 'Set-Cookie': sessionCookie(config, token, mfaPending ? 600 : ttlSec) });
  });

  r.post('/api/auth/mfa/verify', ({ ctx, body }) => {
    if (!ctx || !ctx.mfaPending) throw unauthorized('No pending MFA challenge');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.userId);
    const secret = decrypt(dataKey, Buffer.from(user.mfa_secret_enc, 'base64')).toString('utf8');
    if (!svc.loginLimiter.check(`mfa:${ctx.userId}`)) throw tooMany();
    if (!verifyTotp(secret, String(body.code ?? '').trim())) {
      audit(db, { userId: ctx.userId, action: 'auth.mfa_failed' });
      throw unauthorized('Invalid verification code');
    }
    const session = db.prepare('SELECT org_id FROM sessions WHERE token_hash = ?').get(ctx.tokenHash);
    destroySession(db, ctx.token);
    const token = createSession(db, config, { userId: ctx.userId, orgId: session?.org_id ?? null, mfaPending: false });
    audit(db, { orgId: session?.org_id ?? null, userId: ctx.userId, action: 'auth.login_mfa' });
    return reply(200, { ok: true }, { 'Set-Cookie': sessionCookie(config, token, ttlSec) });
  });

  r.post('/api/auth/logout', ({ ctx }) => {
    if (ctx) { destroySession(db, ctx.token); audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'auth.logout' }); }
    return reply(200, { ok: true }, { 'Set-Cookie': sessionCookie(config, '', 0) });
  });

  r.get('/api/auth/me', ({ ctx }) => meResponse(db, requireAuth(ctx)));

  // Unauthenticated-safe probe used by the web client on load (avoids a 401 before sign-in).
  r.get('/api/auth/status', ({ ctx }) => ({ authenticated: Boolean(ctx && !ctx.mfaPending), mfaPending: Boolean(ctx?.mfaPending) }));

  r.post('/api/auth/mfa/setup', ({ ctx }) => {
    requireAuth(ctx);
    if (ctx.mfaEnabled) throw badRequest('MFA is already enabled');
    const secret = generateTotpSecret();
    db.prepare('UPDATE users SET mfa_secret_enc = ? WHERE id = ?').run(encrypt(dataKey, Buffer.from(secret)).toString('base64'), ctx.userId);
    const label = encodeURIComponent(`ZCIP:${ctx.email}`);
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=ZCIP&algorithm=SHA1&digits=6&period=30` };
  });

  r.post('/api/auth/mfa/enable', ({ ctx, body }) => {
    requireAuth(ctx);
    const user = db.prepare('SELECT mfa_secret_enc, mfa_enabled FROM users WHERE id = ?').get(ctx.userId);
    if (user.mfa_enabled) throw badRequest('MFA is already enabled');
    if (!user.mfa_secret_enc) throw badRequest('Start MFA setup first');
    const secret = decrypt(dataKey, Buffer.from(user.mfa_secret_enc, 'base64')).toString('utf8');
    if (!verifyTotp(secret, String(body.code ?? '').trim())) throw badRequest('Invalid verification code');
    db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(ctx.userId);
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'auth.mfa_enabled' });
    return { ok: true };
  });

  r.post('/api/auth/switch-org', ({ ctx, body }) => {
    requireAuth(ctx);
    const orgId = str(body, 'orgId', { max: 64 });
    const m = db.prepare('SELECT role FROM memberships WHERE user_id = ? AND org_id = ?').get(ctx.userId, orgId);
    if (!m) throw forbidden('You are not a member of that organisation');
    db.prepare('UPDATE sessions SET org_id = ? WHERE token_hash = ?').run(orgId, ctx.tokenHash);
    audit(db, { orgId, userId: ctx.userId, action: 'auth.switch_org' });
    return { ok: true };
  });

  r.post('/api/orgs', ({ ctx, body }) => {
    requireAuth(ctx);
    const fields = readOrgFields(body);
    const orgId = createOrganisation(db, ctx.userId, fields);
    db.prepare('UPDATE sessions SET org_id = ? WHERE token_hash = ?').run(orgId, ctx.tokenHash);
    audit(db, { orgId, userId: ctx.userId, action: 'org.create', target: orgId, metadata: { name: fields.name } });
    return reply(201, { id: orgId });
  });

  // ---- members ----
  r.get('/api/members', ({ ctx }) => {
    requireAuth(ctx); requireOrgPermission(ctx, 'org.read');
    return db.prepare(`SELECT u.id, u.name, u.email, m.role, m.created_at FROM memberships m JOIN users u ON u.id = m.user_id
                       WHERE m.org_id = ? ORDER BY u.name`).all(ctx.orgId);
  });

  r.post('/api/members', ({ ctx, body }) => {
    requireAuth(ctx); requireOrgPermission(ctx, 'member.manage');
    const email = str(body, 'email', { max: 254 }).toLowerCase();
    const role = oneOf(body, 'role', ORG_ROLES);
    if (role === 'owner' && ctx.orgRole !== 'owner') throw forbidden('Only an owner can add another owner');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!user) throw notFound('No registered user has that email. Ask them to register first.');
    if (db.prepare('SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ?').get(user.id, ctx.orgId)) throw badRequest('User is already a member');
    db.prepare('INSERT INTO memberships (user_id, org_id, role, created_at) VALUES (?, ?, ?, ?)').run(user.id, ctx.orgId, role, nowIso());
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'member.add', target: user.id, metadata: { role } });
    return reply(201, { ok: true });
  });

  r.patch('/api/members/:userId', ({ ctx, body, params }) => {
    requireAuth(ctx); requireOrgPermission(ctx, 'member.manage');
    const role = oneOf(body, 'role', ORG_ROLES);
    const current = db.prepare('SELECT role FROM memberships WHERE user_id = ? AND org_id = ?').get(params.userId, ctx.orgId);
    if (!current) throw notFound('Member not found');
    if ((role === 'owner' || current.role === 'owner') && ctx.orgRole !== 'owner') throw forbidden('Only an owner can change owner roles');
    if (current.role === 'owner' && role !== 'owner') {
      const owners = db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE org_id = ? AND role = 'owner'").get(ctx.orgId).n;
      if (owners <= 1) throw badRequest('An organisation must keep at least one owner');
    }
    db.prepare('UPDATE memberships SET role = ? WHERE user_id = ? AND org_id = ?').run(role, params.userId, ctx.orgId);
    audit(db, { orgId: ctx.orgId, userId: ctx.userId, action: 'member.role_change', target: params.userId, metadata: { from: current.role, to: role } });
    return { ok: true };
  });
}
