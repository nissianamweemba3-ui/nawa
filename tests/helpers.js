import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createApp } from '../server/app.js';
import { hashPassword, newId, totp } from '../server/lib/crypto.js';
import { nowIso } from '../server/db.js';

export const PASSWORD = 'correct-horse-42-battery';

export async function startApp({ provider, aiRateLimit, fetchImpl } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zcip-test-'));
  const app = createApp({ dataDir: dir, dbPath: ':memory:', dataKeyHex: '11'.repeat(32), provider, aiRateLimit: aiRateLimit ?? 1000,
    registerRateLimit: 1000, fetchImpl });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    app, base, db: app.db,
    client: () => new Client(base),
    stop: async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

export class Client {
  constructor(base) { this.base = base; this.cookie = ''; }
  async req(method, p, body, headers = {}) {
    const res = await fetch(this.base + p, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  get(p) { return this.req('GET', p); }
  post(p, body = {}) { return this.req('POST', p, body); }
  patch(p, body = {}) { return this.req('PATCH', p, body); }
}

let counter = 0;
export async function registerOrg(env, { orgName = 'Org', flags = {}, email } = {}) {
  const c = env.client();
  const e = email ?? `user${++counter}-${Date.now()}@example.com`;
  const r = await c.post('/api/auth/register', { email: e, password: PASSWORD, name: 'Test User', organisation: { name: orgName, sector: 'Retail', employees: 12, ...flags } });
  if (r.status !== 201) throw new Error(`register failed: ${JSON.stringify(r.data)}`);
  const me = await c.get('/api/auth/me');
  return { client: c, email: e, orgId: me.data.activeOrg.id, userId: me.data.user.id };
}

export function createUser(db, { email, platformRole = 'user' }) {
  const id = newId();
  db.prepare('INSERT INTO users (id, email, name, password_hash, platform_role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, email, email.split('@')[0], hashPassword(PASSWORD), platformRole, nowIso());
  return id;
}

export async function login(env, email) {
  const c = env.client();
  const r = await c.post('/api/auth/login', { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login failed: ${JSON.stringify(r.data)}`);
  return c;
}

export async function addMember(env, owner, email, role) {
  const userId = createUser(env.db, { email });
  const r = await owner.client.post('/api/members', { email, role });
  if (r.status !== 201) throw new Error(`add member failed: ${JSON.stringify(r.data)}`);
  return { client: await login(env, email), userId };
}

export async function upload(client, { title = 'Doc', filename = 'doc.txt', mime = 'text/plain', content, controlId, validUntil, supersedes }) {
  return client.post('/api/evidence', { title, filename, mime, controlId, validUntil, supersedes,
    contentBase64: Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content).toString('base64') });
}

export const ALL_YES = Object.fromEntries(['registration', 'dpo', 'privacy', 'ropa', 'inventory', 'basis', 'sensitive', 'retention', 'breach', 'rights',
  'processors', 'transfer', 'training', 'security', 'dpia'].map((k) => [k, 'yes']));

// A recording provider standing in for a live model. `respond(args, n)` returns the raw model JSON.
export function mockProvider(respond) {
  const p = {
    calls: [],
    get name() { return 'mock-model'; },
    get live() { return true; },
    async complete(args) { p.calls.push(args); return respond(args, p.calls.length); },
  };
  return p;
}

export const currentTotp = (secret) => totp(secret);

// Builds a minimal .docx (ZIP with a deflated word/document.xml) for extraction tests.
export function makeDocx(paragraphs) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${
    paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
  const name = Buffer.from('word/document.xml');
  const data = Buffer.from(xml);
  const comp = zlib.deflateRawSync(data);
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const localPart = Buffer.concat([local, name, comp]);
  const centralPart = Buffer.concat([central, name]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12); eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (~c) >>> 0;
}
