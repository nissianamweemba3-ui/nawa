// Knowledge-base versioning & review, and the regulatory intelligence workflow end to end.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, registerOrg, createUser, login, ALL_YES } from './helpers.js';
import { parseCapturedSections, diffSections, mergeSections, fetchOfficialSource } from '../server/intel/regulatory.js';

let env, admin, reviewer, plain, sensitive;

before(async () => {
  env = await startApp({ fetchImpl: async () => new Response('<html><p>[DPA 2021 — Security] Security of personal data</p><p>Fetched body text about encryption reviews.</p></html>', { headers: { 'content-type': 'text/html' } }) });
  createUser(env.db, { email: 'admin@gov.example', platformRole: 'platform_admin' });
  createUser(env.db, { email: 'reviewer@gov.example', platformRole: 'legal_reviewer' });
  createUser(env.db, { email: 'reviewer2@gov.example', platformRole: 'legal_reviewer' });
  admin = await login(env, 'admin@gov.example');
  reviewer = await login(env, 'reviewer@gov.example');
  plain = await registerOrg(env, { orgName: 'Plain Org' });
  sensitive = await registerOrg(env, { orgName: 'Clinic Org', flags: { processes_sensitive: true } });
  await plain.client.post('/api/assessments', { answers: ALL_YES });
});
after(async () => { await env.stop(); });

test('seeded knowledge base is pilot-baseline, approved, current and clearly marked unverified', async () => {
  const sources = (await plain.client.get('/api/kb/sources')).data;
  assert.equal(sources.length, 4);
  for (const s of sources) {
    const cur = s.versions.filter((v) => v.isCurrent);
    assert.equal(cur.length, 1);
    assert.equal(cur[0].pilotBaseline, true);
  }
  const v = (await plain.client.get(`/api/kb/versions/${sources[0].versions[0].id}`)).data;
  assert.ok(v.sections.every((s) => s.reference_verified === 0));
  const reqs = (await plain.client.get('/api/kb/requirements')).data;
  assert.equal(reqs.length, 15);
  // every requirement source reference resolves to a real seeded section
  const all = [];
  for (const s of sources) all.push(...(await plain.client.get(`/api/kb/versions/${s.versions[0].id}`)).data.sections.map((x) => `${s.id}|${x.ref}`));
  for (const r of reqs) for (const ref of r.sourceRefs) assert.ok(all.includes(`${ref.source_id}|${ref.ref}`), `${r.code} → ${ref.ref}`);
});

test('KB ingestion → four-eyes review → only then retrievable', async () => {
  const body = { versionLabel: 'Guidance 2026', sections: [{ ref: 'DPC Guidance — Cookie guide', heading: 'Cookie consent guide', body: 'Websites using non-essential cookies should obtain consent and offer a clear way to refuse quokka trackers.' }] };
  assert.equal((await reviewer.post('/api/kb/sources/src-dpc-guidance/versions', body)).status, 403, 'reviewers cannot ingest');
  const v = await admin.post('/api/kb/sources/src-dpc-guidance/versions', body);
  assert.equal(v.status, 201);
  assert.equal((await plain.client.get('/api/kb/search?q=quokka%20trackers')).data.length, 0);
  assert.equal((await admin.post(`/api/kb/versions/${v.data.id}/review`, { decision: 'approve' })).status, 403, 'admins cannot approve');
  // a reviewer who also submitted cannot approve their own submission
  env.db.prepare("UPDATE users SET platform_role = 'platform_admin' WHERE email = 'reviewer2@gov.example'").run();
  const r2 = await login(env, 'reviewer2@gov.example');
  const own = await r2.post('/api/kb/sources/src-dpc-guidance/versions', { ...body, versionLabel: 'Own' });
  env.db.prepare("UPDATE users SET platform_role = 'legal_reviewer' WHERE email = 'reviewer2@gov.example'").run();
  const r2b = await login(env, 'reviewer2@gov.example');
  assert.equal((await r2b.post(`/api/kb/versions/${own.data.id}/review`, { decision: 'approve' })).status, 403);
  assert.equal((await r2b.post(`/api/kb/versions/${own.data.id}/review`, { decision: 'reject' })).status, 403);
  // independent reviewer approves
  const ok = await reviewer.post(`/api/kb/versions/${v.data.id}/review`, { decision: 'approve', note: 'Checked against DPC site' });
  assert.equal(ok.status, 200);
  const hits = (await plain.client.get('/api/kb/search?q=quokka%20trackers')).data;
  assert.equal(hits.length, 1);
  const src = (await plain.client.get('/api/kb/sources')).data.find((s) => s.id === 'src-dpc-guidance');
  assert.equal(src.versions.filter((x) => x.isCurrent).length, 1);
  assert.ok(src.versions.some((x) => x.status === 'superseded'));
  assert.equal((await reviewer.post(`/api/kb/versions/${v.data.id}/review`, { decision: 'approve' })).status, 400, 'cannot review twice');
});

test('section parsing, diffing and merging', () => {
  const text = '[A] Alpha\nNew alpha body\n[B] Beta\n[REPEALED]\n[C] Gamma\nBrand new';
  const parsed = parseCapturedSections(text, 'T');
  assert.deepEqual(parsed.map((s) => s.ref), ['A', 'B', 'C']);
  const base = [{ ref: 'A', heading: 'Alpha', body: 'Old alpha body' }, { ref: 'B', heading: 'Beta', body: 'Beta body' }, { ref: 'D', heading: 'Delta', body: 'Same' }];
  const d = diffSections(base, parsed);
  assert.deepEqual([d.modified.length, d.repealed.length, d.added.length], [1, 1, 1]);
  assert.deepEqual(mergeSections(base, parsed).map((s) => s.ref), ['A', 'D', 'C']);
});

test('regulatory change: capture → diff → four-eyes validation → new version → applicability-aware notifications → acknowledgement', async () => {
  const text = '[DPA 2021 — Sensitive personal data] Sensitive personal data\nProcessing sensitive personal data now additionally requires a documented safeguards assessment approved by the DPO before processing begins.';
  assert.equal((await reviewer.post('/api/governance/changes', { sourceId: 'src-dpa-2021', title: 'x', text })).status, 403, 'reviewers cannot capture');
  const cap = await admin.post('/api/governance/changes', { sourceId: 'src-dpa-2021', title: 'Sensitive data amendment', text });
  assert.equal(cap.status, 201);
  assert.equal(cap.data.diff.modified.length, 1);
  assert.ok(cap.data.suggestedRequirements.some((s) => s.code === 'SEN-01'));
  assert.equal(cap.data.capturedSha256.length, 64);

  // Not yet published: tenants see nothing and the AI cannot retrieve the new text.
  assert.equal((await sensitive.client.get('/api/regulatory/notifications')).data.length, 0);
  assert.equal((await plain.client.get('/api/kb/search?q=documented%20safeguards%20assessment%20approved')).data.length, 0);
  // Capturer cannot validate their own capture.
  env.db.prepare("UPDATE users SET platform_role = 'legal_reviewer' WHERE email = 'admin@gov.example'").run();
  const adminAsReviewer = await login(env, 'admin@gov.example');
  assert.equal((await adminAsReviewer.post(`/api/governance/changes/${cap.data.id}/review`, { decision: 'validate', significance: 'high', requirementCodes: ['SEN-01'] })).status, 403);
  env.db.prepare("UPDATE users SET platform_role = 'platform_admin' WHERE email = 'admin@gov.example'").run();

  assert.equal((await reviewer.post(`/api/governance/changes/${cap.data.id}/review`, { decision: 'validate', significance: 'high', requirementCodes: ['NOPE'] })).status, 400);
  const val = await reviewer.post(`/api/governance/changes/${cap.data.id}/review`, { decision: 'validate', significance: 'high', requirementCodes: ['SEN-01'], versionLabel: 'Amended 2026', note: 'Verified against gazette' });
  assert.equal(val.status, 200);
  assert.equal(val.data.status, 'validated');

  // Only the organisation that processes sensitive data is notified (applicability rule).
  const notesSensitive = (await sensitive.client.get('/api/regulatory/notifications')).data;
  const notesPlain = (await plain.client.get('/api/regulatory/notifications')).data;
  assert.equal(notesSensitive.length, 1);
  assert.equal(notesPlain.length, 0);
  assert.deepEqual(notesSensitive[0].affectedControls, ['sensitive']);

  // The published version is now retrievable and supersedes the old one, with other sections carried over.
  assert.equal((await plain.client.get('/api/kb/search?q=documented%20safeguards%20assessment%20approved')).data.length, 1);
  const dpa = (await plain.client.get('/api/kb/sources')).data.find((s) => s.id === 'src-dpa-2021');
  const current = dpa.versions.find((v) => v.isCurrent);
  assert.equal(current.versionLabel, 'Amended 2026');
  assert.equal(current.sectionCount, 18);

  // Insights surface the open regulatory change; acknowledgement creates review tasks and is tracked.
  const ins = (await sensitive.client.get('/api/insights')).data;
  assert.ok(ins.patterns.some((p) => p.id === 'regulatory_change'));
  const ack = await sensitive.client.post(`/api/regulatory/notifications/${notesSensitive[0].id}/acknowledge`, { createTasks: true });
  assert.equal(ack.status, 200);
  assert.equal(ack.data.tasks.length, 1);
  assert.equal(ack.data.tasks[0].source, 'regulatory');
  assert.equal((await sensitive.client.post(`/api/regulatory/notifications/${notesSensitive[0].id}/acknowledge`, {})).status, 400);
  assert.equal((await sensitive.client.get('/api/regulatory/notifications')).data[0].status, 'acknowledged');
  assert.equal((await reviewer.post(`/api/governance/changes/${cap.data.id}/review`, { decision: 'reject' })).status, 400, 'already reviewed');
});

test('stale captures cannot overwrite a newer approved version', async () => {
  const c1 = await admin.post('/api/governance/changes', { sourceId: 'src-reg-2021', title: 'First', text: '[Registration Regulations 2021 — Licensing] Licensing\nUpdated licensing text one.' });
  const c2 = await admin.post('/api/governance/changes', { sourceId: 'src-reg-2021', title: 'Second', text: '[Registration Regulations 2021 — Licensing] Licensing\nUpdated licensing text two.' });
  assert.equal((await reviewer.post(`/api/governance/changes/${c1.data.id}/review`, { decision: 'validate', significance: 'low' })).status, 200);
  const stale = await reviewer.post(`/api/governance/changes/${c2.data.id}/review`, { decision: 'validate', significance: 'low' });
  assert.equal(stale.status, 400);
  assert.match(stale.data.error, /newer approved version/);
});

test('regulatory fetch only from allow-listed official https hosts; content is captured for review', async () => {
  await assert.rejects(fetchOfficialSource('http://www.dpc.gov.zm/x', ['www.dpc.gov.zm']), /https/);
  await assert.rejects(fetchOfficialSource('https://evil.example/x', ['www.dpc.gov.zm']), /allow-list/);
  const cap = await admin.post('/api/governance/changes', { sourceId: 'src-dpa-2021', title: 'Fetched', url: 'https://www.dpc.gov.zm/notice' });
  assert.equal(cap.status, 201);
  assert.equal(cap.data.origin, 'https://www.dpc.gov.zm/notice');
  assert.equal(cap.data.status, 'detected');
  assert.equal(cap.data.diff.modified.length, 1);
});
