// AI Risk Insights & Executive Intelligence. Pattern detection and prioritisation are deterministic,
// rule-based and explainable (each item lists its factors). The deterministic score is never altered.
// The executive narrative may be polished by a model, but every number must trace back to the facts.
import { listControls } from '../kb/store.js';
import { assessmentHistory, evidenceStatus } from '../compliance/state.js';
import { WEIGHTS } from '../compliance/scoring.js';
import { numbersSupported, removeOverclaims } from '../ai/guards.js';
import { BASE_SYSTEM_PROMPT } from '../ai/gateway.js';

const today = () => new Date().toISOString().slice(0, 10);

export function computeInsights(db, repo) {
  const controls = listControls(db);
  const byId = new Map(controls.map((c) => [c.id, c]));
  const org = repo.organisation();
  const history = assessmentHistory(repo);
  const latest = history.at(-1) ?? null;
  const previous = history.at(-2) ?? null;
  const evidence = evidenceStatus(repo, controls);
  const tasks = repo.list('tasks', { limit: 2000 });
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const overdue = openTasks.filter((t) => t.due_date && t.due_date < today());
  const notifications = repo.list('reg_notifications', { where: { status: 'open' }, limit: 500 });
  const regControls = new Set(notifications.flatMap((n) => JSON.parse(n.affected_controls_json)));

  const answerOf = (id) => (latest ? latest.answers[id] ?? null : null);
  const gapIn = (a, id) => a.gaps.some((g) => g.controlId === id);
  const recurring = new Set(previous ? latest.gaps.filter((g) => gapIn(previous, g.controlId)).map((g) => g.controlId) : []);
  const flagApplies = (c) => c.applicability.orgFlag ? Boolean(org[c.applicability.orgFlag]) : false;

  const patterns = [];
  const add = (id, severity, title, detail, controlIds) => { if (controlIds.length) patterns.push({ id, severity, title, detail, controlIds }); };
  const claimedNoEvidence = controls.filter((c) => answerOf(c.id) === 'yes' && evidence[c.id].status === 'missing').map((c) => c.id);
  add('claimed_unevidenced', 'medium', 'Controls marked in place without evidence',
    'These controls are answered "Yes" but no supporting evidence is attached, so the position cannot be demonstrated.', claimedNoEvidence);
  add('evidence_expired', 'high', 'Expired evidence',
    'Evidence attached to these controls has passed its valid-until date.', controls.filter((c) => evidence[c.id].status === 'expired').map((c) => c.id));
  add('evidence_stale', 'medium', 'Evidence older than its review cycle',
    'The newest evidence for these controls is older than the control\'s review cycle.', controls.filter((c) => evidence[c.id].status === 'stale').map((c) => c.id));
  const privacyInPlace = ['yes', 'partial'].includes(answerOf('privacy')) || evidence.privacy.status !== 'missing';
  if (privacyInPlace && ['missing', 'expired'].includes(evidence.training.status)) {
    add('policy_without_training', 'medium', 'Policy exists but no current training evidence',
      'A privacy notice/policy is in place, but no current evidence of staff training is attached (missing or expired).', ['training']);
  }
  add('recurring_gap', 'high', 'Recurring gaps',
    'These gaps appeared in both of the two most recent assessments.', [...recurring]);
  if (overdue.length) {
    patterns.push({ id: 'overdue_tasks', severity: 'high', title: 'Overdue remediation tasks',
      detail: `${overdue.length} remediation task(s) are past their due date.`, controlIds: [...new Set(overdue.map((t) => t.control_id).filter(Boolean))] });
  }
  add('regulatory_change', 'high', 'Controls affected by a reviewed regulatory change',
    'A validated regulatory update affects these controls and has not been acknowledged.', [...regControls]);
  add('applicability_gap', 'high', 'Gaps in controls that specifically apply to you',
    'Your organisation profile indicates these requirements apply (e.g. sensitive data or cross-border transfers), but the control is not fully in place.',
    controls.filter((c) => flagApplies(c) && answerOf(c.id) !== 'yes' && latest).map((c) => c.id));

  // Contextual prioritisation with transparent factors.
  const candidates = new Set([...(latest?.gaps.map((g) => g.controlId) ?? []), ...claimedNoEvidence,
    ...controls.filter((c) => ['expired', 'stale', 'expiring'].includes(evidence[c.id].status)).map((c) => c.id), ...regControls]);
  const priorities = [...candidates].map((id) => {
    const c = byId.get(id);
    const a = answerOf(id);
    const factors = [];
    let score = 0;
    const gapFactor = a === 'yes' ? 0 : a === 'partial' ? 0.5 : 1;
    if (latest && gapFactor > 0) { const p = WEIGHTS[c.priority] * gapFactor * 10; score += p; factors.push(`${c.priority} priority gap (${a ?? 'not answered'}): +${p}`); }
    if (flagApplies(c) && a !== 'yes') { score += 5; factors.push('applies to your profile: +5'); }
    if (recurring.has(id)) { score += 3; factors.push('recurring gap: +3'); }
    if (regControls.has(id)) { score += 4; factors.push('affected by regulatory change: +4'); }
    const ev = evidence[id].status;
    if (ev === 'expired') { score += 4; factors.push('evidence expired: +4'); }
    else if (ev === 'expiring') { score += 2; factors.push('evidence expiring: +2'); }
    else if (ev === 'stale') { score += 2; factors.push('evidence stale: +2'); }
    else if (ev === 'missing' && a === 'yes') { score += 3; factors.push('claimed without evidence: +3'); }
    if (overdue.some((t) => t.control_id === id)) { score += 2; factors.push('overdue task: +2'); }
    return { controlId: id, question: c.question, priority: c.priority, answer: a ?? 'not answered', evidence: ev, score, factors };
  }).sort((x, y) => y.score - x.score || x.controlId.localeCompare(y.controlId));

  const evidenceSummary = Object.values(evidence).reduce((acc, e) => { acc[e.status] = (acc[e.status] ?? 0) + 1; return acc; }, {});
  return {
    generatedAt: new Date().toISOString(),
    trend: history.map((h) => ({ date: h.createdAt, score: h.score, risk: h.risk })),
    latest: latest ? { score: latest.score, risk: latest.risk, date: latest.createdAt, gapCount: latest.gaps.length } : null,
    delta: latest && previous ? latest.score - previous.score : null,
    evidenceSummary,
    evidence,
    tasks: { open: openTasks.length, overdue: overdue.length, done: tasks.length - openTasks.length },
    openRegulatoryNotifications: notifications.length,
    patterns,
    priorities,
  };
}

export function executiveFacts(org, insights) {
  return {
    organisation: org.name,
    score: insights.latest?.score ?? null,
    risk: insights.latest?.risk ?? null,
    scoreChange: insights.delta,
    assessments: insights.trend.length,
    gaps: insights.latest?.gapCount ?? null,
    highPriorityGaps: insights.priorities.filter((p) => p.priority === 'high' && p.answer !== 'yes').length,
    evidenceMissing: insights.evidenceSummary.missing ?? 0,
    evidenceExpired: insights.evidenceSummary.expired ?? 0,
    openTasks: insights.tasks.open,
    overdueTasks: insights.tasks.overdue,
    openRegulatoryNotifications: insights.openRegulatoryNotifications,
    topPriorities: insights.priorities.slice(0, 3).map((p) => p.question),
    patterns: insights.patterns.map((p) => p.title),
  };
}

export function deterministicNarrative(f) {
  if (f.score === null) {
    return `${f.organisation} has not completed a compliance assessment yet. Complete the assessment to establish a baseline score and action plan.`;
  }
  const parts = [];
  parts.push(`${f.organisation} has a deterministic compliance score of ${f.score}% (${f.risk} risk) from its latest assessment` +
    (f.scoreChange === null ? '.' : f.scoreChange === 0 ? ', unchanged from the previous assessment.' :
      `, ${f.scoreChange > 0 ? 'up' : 'down'} ${Math.abs(f.scoreChange)} points from the previous assessment.`));
  parts.push(`There are ${f.gaps} open gap(s), of which ${f.highPriorityGaps} are high priority.`);
  if (f.topPriorities.length) parts.push(`Top priorities: ${f.topPriorities.map((q, i) => `(${i + 1}) ${q}`).join(' ')}`);
  parts.push(`Evidence: ${f.evidenceMissing} control(s) have no evidence and ${f.evidenceExpired} have expired evidence.`);
  parts.push(`Remediation: ${f.openTasks} open task(s), ${f.overdueTasks} overdue.`);
  if (f.openRegulatoryNotifications) parts.push(`${f.openRegulatoryNotifications} reviewed regulatory update(s) await acknowledgement.`);
  if (f.patterns.length) parts.push(`Signals detected: ${f.patterns.join('; ')}.`);
  parts.push('This summary is generated from platform data and is not a legal opinion or certification.');
  return parts.join(' ');
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
