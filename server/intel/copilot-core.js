// Compliance Copilot rules (pure; shared with the browser demo).

export const DUE_DAYS = { high: 14, medium: 30, low: 60 };

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
