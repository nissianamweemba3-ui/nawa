// AI Risk Insights & Executive Intelligence. Pattern detection and prioritisation are deterministic,
// rule-based and explainable (each item lists its factors). The deterministic score is never altered.
// The executive narrative may be polished by a model, but every number must trace back to the facts.
import { listControls } from '../kb/store.js';
import { assessmentHistory, evidenceStatus } from '../compliance/state.js';
import { computeInsightsFrom, executiveFacts, deterministicNarrative } from './insights-core.js';
import { numbersSupported, removeOverclaims } from '../ai/guards.js';
import { BASE_SYSTEM_PROMPT } from '../ai/gateway.js';

export { computeInsightsFrom, executiveFacts, deterministicNarrative } from './insights-core.js';

export function computeInsights(db, repo) {
  const controls = listControls(db);
  return computeInsightsFrom({
    controls,
    org: repo.organisation(),
    history: assessmentHistory(repo),
    evidence: evidenceStatus(repo, controls),
    tasks: repo.list('tasks', { limit: 2000 }),
    openNotifications: repo.list('reg_notifications', { where: { status: 'open' }, limit: 500 })
      .map((n) => ({ id: n.id, affectedControls: JSON.parse(n.affected_controls_json) })),
  });
}

const EXEC_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' }, key_risks: { type: 'array', items: { type: 'string' } } },
  required: ['summary', 'key_risks'],
  additionalProperties: false,
};

export async function executiveSummary(db, repo, gateway, ctx) {
  const insights = computeInsights(db, repo);
  const facts = executiveFacts(repo.organisation(), insights);
  const fallback = deterministicNarrative(facts);
  const outcome = await gateway.run(ctx, {
    kind: 'executive_summary',
    input: 'Generate executive summary',
    schema: EXEC_SCHEMA,
    skipModel: facts.score === null,
    buildPrompt: () => ({
      system: BASE_SYSTEM_PROMPT,
      user: 'Write a concise management-ready compliance summary (at most 180 words) and up to 4 key risks, using ONLY these facts. ' +
        'Refer to the organisation as "the organisation". Do not introduce any number that is not in the facts. ' +
        'Do not recalculate the score.\nFACTS:\n' + JSON.stringify({ ...facts, organisation: 'the organisation' }),
    }),
    offline: () => ({ summary: fallback, key_risks: insights.patterns.slice(0, 4).map((p) => p.title) }),
    validate: (raw, mode) => {
      const flags = [];
      let summary = typeof raw?.summary === 'string' ? raw.summary : '';
      let keyRisks = Array.isArray(raw?.key_risks) ? raw.key_risks.filter((r) => typeof r === 'string').slice(0, 4) : [];
      const check = numbersSupported(`${summary} ${keyRisks.join(' ')}`, facts);
      if (mode === 'model' && (!summary || !check.ok)) {
        flags.push({ id: 'unsupported_numbers_rejected', detail: check.unsupported.slice(0, 10) });
        summary = fallback;
        keyRisks = insights.patterns.slice(0, 4).map((p) => p.title);
      }
      const oc = removeOverclaims(summary);
      if (oc.removed) flags.push({ id: 'overclaim_removed', detail: oc.removed });
      return { result: { summary: oc.text, keyRisks, citations: [], insufficientSources: false }, flags };
    },
  });
  return { ...outcome, facts, insights };
}
