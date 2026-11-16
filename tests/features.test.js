// Compliance features and intelligence modules in deterministic mode (no model configured).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, registerOrg, addMember, upload, makeDocx, ALL_YES } from './helpers.js';
import { docxToText } from '../server/lib/extract.js';

let env, owner;
before(async () => {
  env = await startApp(); // offline provider
  owner = await registerOrg(env, { orgName: 'Feature Co', flags: { transfers_abroad: true } });
});
after(async () => { await env.stop(); });

test('assessment stores the deterministic score with an explanation and breakdown', async () => {
  const r = await owner.client.post('/api/assessments', { answers: { registration: 'yes', dpo: 'partial', privacy: 'no' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.score, 11); // (3 + 1.5) / 41 → 10.97 → 11, as in the MVP
  assert.equal(r.data.risk, 'High');
  assert.equal(r.data.gaps.length, 14);
  assert.equal(r.data.breakdown.length, 15);
  assert.match(r.data.explanation, /round/);
  assert.equal((await owner.client.post('/api/assessments', { answers: { registration: 'maybe' } })).status, 400);
});

test('evidence is encrypted at rest, versioned, downloadable, and type-checked', async () => {
  const v1 = await upload(owner.client, { title: 'Breach procedure', filename: '../../etc/breach.txt', content: 'v1 procedure', controlId: 'breach' });
  assert.equal(v1.status, 201);
  assert.equal(v1.data.filename, 'breach.txt', 'path components are stripped');
  const row = env.db.prepare('SELECT storage_key, org_id FROM evidence WHERE id = ?').get(v1.data.id);
  const raw = (await import('node:fs')).readFileSync(env.app.svc.store.pathFor(row.org_id, row.storage_key));
  assert.ok(!raw.includes(Buffer.from('v1 procedure')), 'file must not be stored in plaintext');
  const v2 = await upload(owner.client, { title: 'Breach procedure', filename: 'breach.txt', content: 'v2 procedure', controlId: 'breach', supersedes: v1.data.id });
  assert.equal(v2.data.version, 2);
  const dl = await fetch(`${env.base}/api/evidence/${v2.data.id}/download`, { headers: { Cookie: owner.client.cookie } });
  assert.equal(await dl.text(), 'v2 procedure');
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  assert.equal((await upload(owner.client, { filename: 'x.pdf', mime: 'application/pdf', content: 'not a pdf' })).status, 400);
  assert.equal((await upload(owner.client, { filename: 'x.exe', mime: 'application/x-msdownload', content: 'MZ' })).status, 400);
  const list = (await owner.client.get('/api/evidence')).data;
  assert.equal(list.status.breach.count, 1, 'superseded versions do not count twice');
});

test('evidence freshness: expired and expiring evidence are detected', async () => {
  await upload(owner.client, { title: 'Old training record', content: 'Training attendance 2020', controlId: 'training', validUntil: '2020-01-01' });
  const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await upload(owner.client, { title: 'DPC certificate', content: 'certificate', controlId: 'registration', validUntil: soon });
  const st = (await owner.client.get('/api/evidence')).data.status;
  assert.equal(st.training.status, 'expired');
  assert.equal(st.registration.status, 'expiring');
  assert.equal(st.ropa.status, 'missing');
});

test('copilot explains a control, proposes a next action and creates a task only on acceptance', async () => {
  const g = (await owner.client.get('/api/copilot/privacy')).data;
  assert.equal(g.control.weight, 3);
  assert.equal(g.status.answer, 'no');
  assert.equal(g.nextAction.code, 'implement');
  assert.ok(g.sources.length > 0);
  assert.ok(g.suggestedTask);
  const before = (await owner.client.get('/api/tasks')).data.length;
  const t = await owner.client.post('/api/copilot/privacy/accept-task');
  assert.equal(t.status, 201);
  assert.equal(t.data.source, 'copilot');
  assert.equal((await owner.client.get('/api/tasks')).data.length, before + 1);
  const reg = (await owner.client.get('/api/copilot/registration')).data;
  assert.equal(reg.nextAction.code, 'renew_soon', 'answered yes with expiring evidence → renew soon');
  assert.equal((await owner.client.get('/api/copilot/nope')).status, 404);
});

test('task lifecycle: contributors update status but cannot re-plan', async () => {
  const t = (await owner.client.post('/api/tasks', { title: 'Write ROPA', priority: 'high', controlId: 'ropa', dueDate: '2020-01-01' })).data;
  const contrib = await addMember(env, owner, 'contrib-features@example.com', 'contributor');
  assert.equal((await contrib.client.patch(`/api/tasks/${t.id}`, { status: 'in_progress' })).data.status, 'in_progress');
  assert.equal((await contrib.client.patch(`/api/tasks/${t.id}`, { dueDate: '2030-01-01' })).status, 403);
  assert.equal((await owner.client.patch(`/api/tasks/${t.id}`, { priority: 'low' })).data.priority, 'low');
});

test('insights: patterns, recurring gaps, applicability and explainable priorities', async () => {
  await owner.client.post('/api/assessments', { answers: { ...ALL_YES, transfer: 'no', ropa: 'partial', privacy: 'yes' } });
  const i = (await owner.client.get('/api/insights')).data;
  const ids = i.patterns.map((p) => p.id);
  for (const id of ['claimed_unevidenced', 'evidence_expired', 'policy_without_training', 'recurring_gap', 'overdue_tasks', 'applicability_gap']) assert.ok(ids.includes(id), id);
  assert.ok(i.patterns.find((p) => p.id === 'applicability_gap').controlIds.includes('transfer'));
  assert.equal(i.trend.length, 2);
  assert.equal(i.delta, i.trend[1].score - i.trend[0].score);
  const top = i.priorities[0];
  assert.equal(top.controlId, 'transfer');
  assert.ok(top.factors.some((f) => f.includes('applies to your profile')));
  for (let k = 1; k < i.priorities.length; k++) assert.ok(i.priorities[k - 1].score >= i.priorities[k].score);
  // Insights never change the deterministic score.
  assert.equal(i.latest.score, (await owner.client.get('/api/assessments/latest')).data.assessment.score);
});

test('executive summary (deterministic mode) uses only platform facts', async () => {
  const r = (await owner.client.post('/api/insights/executive-summary')).data;
  assert.equal(r.mode, 'deterministic');
  assert.ok(r.summary.includes(`${r.facts.score}%`));
  assert.match(r.summary, /not a legal opinion or certification/);
});

test('document intelligence on a .docx: findings, human review, task creation', async () => {
  const docx = makeDocx(['Data breach response procedure', 'Staff must report a suspected breach to the DPO immediately.',
    'The incident response team will contain the breach and assess the risk to data subjects.',
    'We keep an incident register of all breaches & near misses.']);
  assert.match(docxToText(docx), /incident register of all breaches & near misses/);
  const ev = (await upload(owner.client, { title: 'Breach SOP', filename: 'sop.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: docx, controlId: 'breach' })).data;
  const a = await owner.client.post('/api/documents/analyse', { evidenceId: ev.id, checklist: 'breach_procedure' });
  assert.equal(a.status, 201);
  const byItem = Object.fromEntries(a.data.findings.map((f) => [f.itemId, f]));
  for (const k of ['detect_report', 'contain', 'assess', 'register', 'roles']) assert.equal(byItem[k].status, 'covered', k);
  for (const k of ['notify_regulator', 'notify_subjects', 'lessons']) assert.equal(byItem[k].status, 'potential_gap', k);
  assert.match(byItem.notify_regulator.observation, /not a legal determination/);
  const contrib = await addMember(env, owner, 'contrib-docs@example.com', 'contributor');
  assert.equal((await contrib.client.post(`/api/documents/analyses/${a.data.id}/findings/${byItem.notify_regulator.id}/review`, { decision: 'accept' })).status, 403);
  const acc = await owner.client.post(`/api/documents/analyses/${a.data.id}/findings/${byItem.notify_regulator.id}/review`, { decision: 'accept', note: 'Add DPC step' });
  assert.equal(acc.status, 200);
  assert.equal(acc.data.task.source, 'document_ai');
  assert.equal((await owner.client.post(`/api/documents/analyses/${a.data.id}/findings/${byItem.notify_regulator.id}/review`, { decision: 'dismiss' })).status, 400);
  const dis = await owner.client.post(`/api/documents/analyses/${a.data.id}/findings/${byItem.lessons.id}/review`, { decision: 'dismiss' });
  assert.equal(dis.data.task, null);
  assert.equal((await owner.client.post(`/api/documents/analyses/${a.data.id}/findings/${byItem.contain.id}/review`, { decision: 'accept' })).status, 400, 'covered items need no review');
  const pdf = (await upload(owner.client, { filename: 'x.pdf', mime: 'application/pdf', content: '%PDF-1.4 fake' })).data;
  assert.equal((await owner.client.post('/api/documents/analyse', { evidenceId: pdf.id, checklist: 'breach_procedure' })).status, 400);
});

test('starter document generator carries the MVP content plus gaps and approved references', async () => {
  const d = (await owner.client.post('/api/documents/generate', { type: 'Data Breach Response Procedure', dpo: 'Jane Banda' })).data;
  assert.match(d.text, /^DATA BREACH RESPONSE PROCEDURE/);
  assert.match(d.text, /Responsible person: Jane Banda/);
  assert.match(d.text, /INCIDENT STEPS/);
  assert.match(d.text, /APPROVED SOURCE REFERENCES/);
  assert.match(d.text, /LEGAL REVIEW/);
  assert.ok(d.sources.length >= 1);
  assert.equal((await owner.client.post('/api/documents/generate', { type: 'Bogus' })).status, 400);
});

test('assistant in deterministic mode quotes approved sources with citations', async () => {
  const r = (await owner.client.post('/api/assistant/ask', { question: 'What rights do data subjects have?', controlId: 'rights' })).data;
  assert.equal(r.mode, 'deterministic');
  assert.equal(r.insufficientSources, false);
  assert.ok(r.citations.length > 0);
  for (const id of r.citations) assert.ok(r.answer.includes(`[${id}]`));
  assert.ok(r.sources.every((s) => r.citations.includes(s.id)));
  assert.match(r.answer, /pilot-baseline summaries/);
});

test('audit trail records actions and the chain verifies', async () => {
  const log = (await owner.client.get('/api/audit')).data;
  const actions = new Set(log.map((a) => a.action));
  for (const a of ['assessment.create', 'evidence.upload', 'evidence.download', 'task.create', 'document.analyse', 'finding.review', 'ai.assistant']) assert.ok(actions.has(a), a);
  assert.equal((await owner.client.get('/api/audit/verify')).data.valid, true);
});
