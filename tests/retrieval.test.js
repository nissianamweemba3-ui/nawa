// RAG accuracy regression (Phase Three §19): relevant approved sources are retrieved for realistic questions,
// and off-topic questions retrieve nothing (so the assistant answers with safe uncertainty).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { seedKnowledgeBase } from '../server/kb/store.js';
import { LegalIndex, stem } from '../server/kb/retrieval.js';

const db = openDatabase(':memory:');
seedKnowledgeBase(db);
const index = new LegalIndex(db);

const EXPECT = [
  ['What evidence should we keep for breach management?', 'DPC Guidance — Breach guide'],
  ['When must a personal data breach be notified?', 'DPA 2021 — Breach notification'],
  ['Do we need to register with the Data Protection Commission?', 'DPA 2021 — Registration'],
  ['What should our privacy notice include?', 'DPA 2021 — Transparency'],
  ['Can we store customer data on a cloud server in South Africa?', 'DPA 2021 — Cross-border transfers'],
  ['Do we need a DPO?', 'DPA 2021 — Data Protection Officer'],
  ['How long can we retain employee records?', 'DPA 2021 — Retention'],
  ['What rights do customers have over their data?', 'DPA 2021 — Data subject rights'],
  ['Do we need consent to send marketing messages?', 'DPA 2021 — Consent'],
  ['What contract terms do we need with vendors that process data for us?', 'DPA 2021 — Processors'],
  ['When is an impact assessment required?', 'DPA 2021 — Impact assessment'],
  ['How should we handle health information of patients?', 'DPA 2021 — Sensitive personal data'],
  ['What security measures are expected?', 'DPA 2021 — Security'],
  ['What is a record of processing activities?', 'DPA 2021 — Accountability records'],
  ['Do staff need data protection training?', 'DPC Guidance — Training guide'],
  ['Can a customer ask us to delete their information?', 'DPA 2021 — Data subject rights'],
  ['What are the penalties for non-compliance?', 'DPA 2021 — Enforcement'],
];

const OFF_TOPIC = [
  'What is the corporate income tax rate and VAT threshold?',
  'What is the minimum wage in Lusaka?',
  'Who won the football match yesterday?',
  'How do I register a company with PACRA?',
  'What are the import duties on vehicles?',
  'Write me a poem about the weather',
  'What is the capital gains tax on property?',
];

for (const [q, ref] of EXPECT) {
  test(`retrieves "${ref}" for: ${q}`, () => {
    const hits = index.search(q);
    assert.ok(hits.length > 0, 'expected at least one approved source');
    assert.ok(hits.slice(0, 3).some((h) => h.ref === ref), `top-3 were: ${hits.slice(0, 3).map((h) => h.ref).join(' | ')}`);
  });
}

test('off-topic questions retrieve no sources', () => {
  for (const q of OFF_TOPIC) assert.deepEqual(index.search(q).map((h) => h.ref), [], q);
});

test('stemmer normalises inflections consistently', () => {
  assert.equal(stem('store'), stem('stored'));
  assert.equal(stem('measure'), stem('measures'));
  assert.equal(stem('breaches'), stem('breach'));
  assert.equal(stem('mining'), 'mining');
});
