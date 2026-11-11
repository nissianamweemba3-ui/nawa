// Compliance Copilot: guided, per-control workflow — explain the question, show evidence expectations
// against what has been uploaded, link approved sources, and propose a next action. Proposals become
// tasks only when a user explicitly accepts them (human in the loop).
import { listControls } from '../kb/store.js';
import { latestAssessment, evidenceStatus } from '../compliance/state.js';
import { WEIGHTS } from '../compliance/scoring.js';
import { describeChunk } from '../ai/assistant.js';
import { notFound } from '../lib/http.js';

const DUE_DAYS = { high: 14, medium: 30, low: 60 };

export function addDays(days, from = new Date()) {
  const d = new Date(from.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function nextAction(answer, evStatus, control) {
  if (answer === 'not assessed') return { code: 'assess', text: 'Answer this question in the assessment so the platform can score it.' };
  if (answer === 'no' || answer === 'not answered') {
    return { code: 'implement', text: `Implement the control: ${control.plainLanguage.split('. ')[0]}. Then upload evidence such as: ${control.evidence[0]}.` };
  }
  if (answer === 'partial') return { code: 'complete', text: `Close the remaining gap and document it. Evidence to aim for: ${control.evidence.join('; ')}.` };
  if (evStatus === 'missing') return { code: 'evidence', text: `The control is marked as in place but no evidence is attached. Upload: ${control.evidence[0]}.` };
  if (evStatus === 'expired') return { code: 'renew', text: 'Attached evidence has expired. Renew it and upload the new version.' };
  if (evStatus === 'expiring') return { code: 'renew_soon', text: 'Evidence expires within 30 days. Schedule renewal now.' };
  if (evStatus === 'stale') return { code: 'review', text: `Evidence is older than the ${control.reviewCycleDays}-day review cycle. Review and re-confirm it.` };
  return { code: 'maintain', text: 'Control is in place with current evidence. Keep it under periodic review.' };
}

export function copilotGuide(db, repo, index, controlId) {
  const control = listControls(db).find((c) => c.id === controlId);
  if (!control) throw notFound('Unknown control');
  const latest = latestAssessment(repo);
  const answer = !latest ? 'not assessed' : (latest.answers[control.id] ?? 'not answered');
  const ev = evidenceStatus(repo, [control])[control.id];
  const action = nextAction(answer, ev.status, control);
  const evidenceItems = repo.list('evidence', { where: { control_id: control.id }, limit: 50 })
    .map((e) => ({ id: e.id, title: e.title, filename: e.filename, version: e.version, validUntil: e.valid_until, createdAt: e.created_at }));
  const needsTask = !['maintain', 'assess'].includes(action.code);
  return {
    control: {
      id: control.id, question: control.question, priority: control.priority, weight: WEIGHTS[control.priority],
      requirementCode: control.requirementCode, requirementTitle: control.requirementTitle,
      plainLanguage: control.plainLanguage, evidenceExpectations: control.evidence, reviewCycleDays: control.reviewCycleDays,
    },
    status: { answer, evidence: ev, evidenceItems },
    whyItMatters: `This is a ${control.priority}-priority control (weight ${WEIGHTS[control.priority]} in the deterministic score). ` +
      (answer === 'yes' ? 'It currently earns full points.' : answer === 'partial' ? 'It currently earns half points.' :
        answer === 'not assessed' ? 'It has not been assessed yet.' : 'It currently earns no points and appears in the action plan.'),
    nextAction: action,
    suggestedTask: needsTask ? {
      title: `${control.requirementTitle}: ${action.code === 'evidence' || action.code.startsWith('renew') || action.code === 'review' ? 'update evidence' : 'close gap'}`,
      description: action.text, controlId: control.id, priority: control.priority, dueDate: addDays(DUE_DAYS[control.priority]),
    } : null,
    sources: index.chunksForRefs(control.sourceRefs).map(describeChunk),
  };
}
