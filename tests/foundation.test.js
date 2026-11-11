// Foundation: crypto primitives, MVP scoring parity, audit chain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server/config.js';
import { totp, verifyTotp, hashPassword, verifyPassword, encrypt, decrypt, base32Encode, base32Decode } from '../server/lib/crypto.js';
import { scoreAssessment, riskBand } from '../server/compliance/scoring.js';
import { CONTROLS } from '../server/kb/seed-data.js';
import { openDatabase } from '../server/db.js';
import { audit, verifyAuditChain } from '../server/lib/audit.js';

test('TOTP matches the RFC 6238 SHA-1 test vector', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(totp(secret, { time: 59_000, digits: 8 }), '94287082');
  assert.equal(totp(secret, { time: 1_111_111_109_000, digits: 8 }), '07081804');
  assert.equal(totp(secret, { time: 1_234_567_890_000, digits: 8 }), '89005924');
  const now = Date.now();
  assert.ok(verifyTotp(secret, totp(secret, { time: now }), { time: now }));
  assert.ok(verifyTotp(secret, totp(secret, { time: now - 30_000 }), { time: now }), 'one step of drift tolerated');
  assert.ok(!verifyTotp(secret, totp(secret, { time: now - 120_000 }), { time: now }), 'old codes rejected');
  assert.ok(!verifyTotp(secret, 'abcdef'));
});

test('base32 round-trips arbitrary bytes', () => {
  for (let n = 0; n < 50; n++) {
    const b = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + n) & 255));
    assert.deepEqual(base32Decode(base32Encode(b)), b);
  }
});

test('password hashing verifies correct and rejects wrong passwords', () => {
  const h = hashPassword('s3cret-passphrase');
  assert.ok(h.startsWith('scrypt$'));
  assert.ok(verifyPassword('s3cret-passphrase', h));
  assert.ok(!verifyPassword('s3cret-passphrasf', h));
  assert.ok(!verifyPassword('x', 'not-a-hash'));
});

test('AES-256-GCM encryption is authenticated', () => {
  const key = Buffer.alloc(32, 7);
  const blob = encrypt(key, Buffer.from('evidence'));
  assert.equal(decrypt(key, blob).toString(), 'evidence');
  blob[blob.length - 1] ^= 1;
  assert.throws(() => decrypt(key, blob));
});

// Literal re-implementation of legacy/mvp/index.html calculate(), driven by the MVP's own question list.
function mvpQuestions() {
  const html = fs.readFileSync(path.join(ROOT, 'legacy/mvp/index.html'), 'utf8');
  const block = html.slice(html.indexOf('const qs=['), html.indexOf('];', html.indexOf('const qs=[')));
  return [...block.matchAll(/\["(\w+)","([^"]+)","(\w+)"\]/g)].map((m) => [m[1], m[2], m[3]]);
}
function mvpCalculate(qs, answers) {
  let total = 0, max = 0; const gaps = [];
  qs.forEach(([id, text, r]) => {
    const weight = r === 'high' ? 3 : r === 'medium' ? 2 : 1; max += weight;
    const a = answers[id]; const points = a === 'yes' ? weight : a === 'partial' ? weight * 0.5 : 0; total += points;
    if (a !== 'yes') gaps.push({ text, r, a: a || 'not answered' });
  });
  const score = Math.round(total / max * 100);
  return { score, risk: score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High', gaps };
}

test('catalogue preserves the 15 MVP questions exactly (id, wording, priority, order)', () => {
  const qs = mvpQuestions();
  assert.equal(qs.length, 15);
  assert.deepEqual(CONTROLS.map(([id, , q, p]) => [id, q, p]), qs);
});

test('deterministic engine reproduces MVP scoring for 2,000 random answer sets', () => {
  const qs = mvpQuestions();
  const controls = qs.map(([id, question, priority]) => ({ id, question, priority }));
  const opts = ['yes', 'partial', 'no', undefined];
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 2000; i++) {
    const answers = {};
    for (const [id] of qs) { const a = opts[Math.floor(rand() * 4)]; if (a) answers[id] = a; }
    const mvp = mvpCalculate(qs, answers);
    const ours = scoreAssessment(controls, answers);
    assert.equal(ours.score, mvp.score);
    assert.equal(ours.risk, mvp.risk);
    assert.deepEqual(ours.gaps.map((g) => [g.question, g.priority, g.answer]), mvp.gaps.map((g) => [g.text, g.r, g.a]));
  }
});

test('risk bands follow the MVP thresholds', () => {
  assert.equal(riskBand(80), 'Low'); assert.equal(riskBand(79), 'Medium'); assert.equal(riskBand(60), 'Medium'); assert.equal(riskBand(59), 'High');
});

test('audit log hash chain detects tampering and deletion', () => {
  const db = openDatabase(':memory:');
  for (let i = 0; i < 5; i++) audit(db, { action: `test.${i}`, metadata: { i } });
  assert.deepEqual(verifyAuditChain(db), { valid: true, entries: 5 });
  db.prepare("UPDATE audit_log SET metadata_json = '{\"i\":99}' WHERE seq = 3").run();
  assert.equal(verifyAuditChain(db).valid, false);
  const db2 = openDatabase(':memory:');
  for (let i = 0; i < 4; i++) audit(db2, { action: `test.${i}` });
  db2.prepare('DELETE FROM audit_log WHERE seq = 2').run();
  assert.equal(verifyAuditChain(db2).valid, false);
});
