// Authentication, MFA, RBAC and HTTP security controls.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, registerOrg, addMember, login, createUser, PASSWORD, currentTotp, upload } from './helpers.js';

let env;
before(async () => { env = await startApp(); });
after(async () => { await env.stop(); });

test('register creates an owner session; logout ends it', async () => {
  const o = await registerOrg(env, { orgName: 'Alpha' });
  const me = await o.client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.activeOrg.role, 'owner');
  assert.equal(me.data.user.platformRole, 'user', 'platform roles cannot be self-assigned');
  await o.client.post('/api/auth/logout');
  assert.equal((await o.client.get('/api/auth/me')).status, 401);
});

test('session cookie is HttpOnly and SameSite=Strict; password is never returned', async () => {
  const c = env.client();
  const r = await c.post('/api/auth/register', { email: 'cookie@example.com', password: PASSWORD, name: 'Cookie', organisation: { name: 'Cookie Co' } });
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const me = await c.get('/api/auth/me');
  assert.ok(!JSON.stringify(me.data).includes('password'));
});

test('weak passwords and duplicate emails are rejected; bad logins give a generic error', async () => {
  const c = env.client();
  assert.equal((await c.post('/api/auth/register', { email: 'weak@example.com', password: 'short', name: 'Weak', organisation: { name: 'W' + 'x' } })).status, 400);
  await registerOrg(env, { email: 'dup@example.com' });
  assert.equal((await c.post('/api/auth/register', { email: 'dup@example.com', password: PASSWORD, name: 'Dup', organisation: { name: 'Dup Co' } })).status, 400);
  const bad = await c.post('/api/auth/login', { email: 'dup@example.com', password: 'wrong-password-123' });
  const unknown = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong-password-123' });
  assert.equal(bad.status, 401); assert.equal(unknown.status, 401);
  assert.equal(bad.data.error, unknown.data.error);
});

test('MFA: enable with TOTP, then login requires a code and a pending session has no access', async () => {
  const o = await registerOrg(env, { email: 'mfa@example.com' });
  const setup = await o.client.post('/api/auth/mfa/setup');
  assert.equal(setup.status, 200);
  assert.equal((await o.client.post('/api/auth/mfa/enable', { code: '000000' })).status, 400);
  assert.equal((await o.client.post('/api/auth/mfa/enable', { code: currentTotp(setup.data.secret) })).status, 200);

  const c = env.client();
  const l = await c.post('/api/auth/login', { email: 'mfa@example.com', password: PASSWORD });
  assert.equal(l.data.mfaRequired, true);
  assert.equal((await c.get('/api/auth/me')).status, 401);
  assert.equal((await c.get('/api/tasks')).status, 401);
  assert.equal((await c.post('/api/auth/mfa/verify', { code: '123456' })).status, 401);
  assert.equal((await c.post('/api/auth/mfa/verify', { code: currentTotp(setup.data.secret) })).status, 200);
  const me = await c.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.mfaEnabled, true);
});

test('RBAC: viewer can read but not write; contributor cannot review findings or manage members', async () => {
  const owner = await registerOrg(env, { orgName: 'RBAC Co' });
  const viewer = await addMember(env, owner, 'viewer-rbac@example.com', 'viewer');
  const contributor = await addMember(env, owner, 'contrib-rbac@example.com', 'contributor');
  assert.equal((await viewer.client.get('/api/tasks')).status, 200);
  assert.equal((await viewer.client.post('/api/assessments', { answers: {} })).status, 403);
  assert.equal((await viewer.client.post('/api/assistant/ask', { question: 'What is a privacy notice?' })).status, 403);
  assert.equal((await upload(viewer.client, { content: 'x' })).status, 403);
  assert.equal((await contributor.client.post('/api/assessments', { answers: { registration: 'yes' } })).status, 201);
  assert.equal((await contributor.client.post('/api/tasks', { title: 'Task', priority: 'high' })).status, 403);
  assert.equal((await contributor.client.post('/api/members', { email: 'x@example.com', role: 'viewer' })).status, 403);
  assert.equal((await contributor.client.post('/api/insights/executive-summary')).status, 403);
  assert.equal((await contributor.client.get('/api/audit')).status, 403);
});

test('only owners manage owners, and the last owner cannot be demoted', async () => {
  const owner = await registerOrg(env, { orgName: 'Owners Co' });
  const admin = await addMember(env, owner, 'admin-own@example.com', 'admin');
  assert.equal((await admin.client.post('/api/members', { email: 'owner-wannabe@example.com', role: 'owner' })).status, 403);
  assert.equal((await admin.client.patch(`/api/members/${owner.userId}`, { role: 'viewer' })).status, 403);
  assert.equal((await owner.client.patch(`/api/members/${owner.userId}`, { role: 'viewer' })).status, 400);
});

test('platform roles grant governance but no tenant access', async () => {
  createUser(env.db, { email: 'reviewer-x@example.com', platformRole: 'legal_reviewer' });
  const r = await login(env, 'reviewer-x@example.com');
  assert.equal((await r.get('/api/kb/sources')).status, 200);
  assert.equal((await r.get('/api/tasks')).status, 403);
  assert.equal((await r.get('/api/evidence')).status, 403);
  assert.equal((await r.post('/api/assistant/ask', { question: 'What is registration?' })).status, 403);
});

test('cannot switch into an organisation you are not a member of', async () => {
  const a = await registerOrg(env, { orgName: 'Switch A' });
  const b = await registerOrg(env, { orgName: 'Switch B' });
  assert.equal((await a.client.post('/api/auth/switch-org', { orgId: b.orgId })).status, 403);
});

test('CSRF defences: non-JSON bodies and cross-origin requests are rejected', async () => {
  const o = await registerOrg(env);
  const form = await fetch(`${env.base}/api/tasks`, { method: 'POST', headers: { Cookie: o.client.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'title=x' });
  assert.equal(form.status, 415);
  const cross = await o.client.req('POST', '/api/tasks', { title: 'Cross', priority: 'high' }, { Origin: 'https://evil.example' });
  assert.equal(cross.status, 403);
  const nullOrigin = await o.client.req('POST', '/api/tasks', { title: 'Cross', priority: 'high' }, { Origin: 'null' });
  assert.equal(nullOrigin.status, 403);
});

test('security headers and a strict CSP are sent; static path traversal is not possible', async () => {
  const res = await fetch(`${env.base}/`);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const trav = await fetch(`${env.base}/..%2f..%2fpackage.json`);
  const body = await trav.text();
  assert.ok(!body.includes('"dependencies"'), 'must not serve files outside web/');
});

test('login is rate limited', async () => {
  const c = env.client();
  let last;
  for (let i = 0; i < 12; i++) last = await c.post('/api/auth/login', { email: 'ratelimit@example.com', password: 'nope-nope-123' });
  assert.equal(last.status, 429);
});
