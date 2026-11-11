// Deterministic, explainable compliance scoring engine — the source of truth for risk outcomes.
// This is a faithful port of the MVP algorithm (legacy/mvp/index.html `calculate()`), verified by the
// parity test in tests/scoring.test.js. AI never changes these numbers; it may only explain them.

export const ENGINE_VERSION = 'mvp-weighted-1.0';
export const WEIGHTS = { high: 3, medium: 2, low: 1 };
export const ANSWERS = ['yes', 'partial', 'no'];

export function riskBand(score) {
  return score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High';
}

export function scoreAssessment(controls, answers) {
  let total = 0, max = 0;
  const gaps = [];
  const breakdown = [];
  for (const c of controls) {
    const weight = WEIGHTS[c.priority] ?? 1;
    max += weight;
    const raw = answers?.[c.id];
    const a = ANSWERS.includes(raw) ? raw : null;
    const points = a === 'yes' ? weight : a === 'partial' ? weight * 0.5 : 0;
    total += points;
    breakdown.push({ controlId: c.id, priority: c.priority, weight, answer: a, points });
    if (a !== 'yes') gaps.push({ controlId: c.id, question: c.question, priority: c.priority, answer: a ?? 'not answered' });
  }
  const score = max === 0 ? 0 : Math.round((total / max) * 100);
  return {
    engineVersion: ENGINE_VERSION,
    score,
    risk: riskBand(score),
    gaps,
    breakdown,
    explanation: `Score = round(points earned ${total} / maximum ${max} × 100). High priority = 3, medium = 2, low = 1; ` +
      "'Yes' earns full weight, 'Partially' half, 'No' or unanswered zero. Bands: ≥80 Low, ≥60 Medium, otherwise High risk.",
  };
}
