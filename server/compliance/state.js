// Read models over tenant data: latest assessment, evidence freshness, and the minimised organisation
// context that AI features are allowed to see. Everything here goes through a TenantRepo.

const DAY = 86_400_000;

export function latestAssessment(repo) {
  const [a] = repo.list('assessments', { limit: 1 });
  return a ? hydrateAssessment(a) : null;
}

export function assessmentHistory(repo, limit = 50) {
  return repo.list('assessments', { orderBy: 'created_at ASC', limit }).map(hydrateAssessment);
}

export function hydrateAssessment(a) {
  return {
    id: a.id, score: a.score, risk: a.risk, answers: JSON.parse(a.answers_json), gaps: JSON.parse(a.gaps_json),
    engineVersion: a.engine_version, createdAt: a.created_at, createdBy: a.created_by,
  };
}

// Evidence freshness per control: missing | current | expiring (≤30 days) | expired | stale (older than review cycle).
export function evidenceStatus(repo, controls, now = Date.now()) {
  const all = repo.list('evidence', { limit: 5000 });
  const out = {};
  for (const c of controls) {
    const items = all.filter((e) => e.control_id === c.id);
    if (items.length === 0) { out[c.id] = { status: 'missing', count: 0 }; continue; }
    // Latest version per evidence chain = rows not superseded by another row.
    const supersededIds = new Set(items.map((e) => e.supersedes).filter(Boolean));
    const live = items.filter((e) => !supersededIds.has(e.id));
    const newest = live.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    let status = 'current';
    const validUntil = live.map((e) => e.valid_until).filter(Boolean).sort().pop() ?? null;
    if (validUntil && Date.parse(validUntil) < now) status = 'expired';
    else if (validUntil && Date.parse(validUntil) - now <= 30 * DAY) status = 'expiring';
    else if (now - Date.parse(newest.created_at) > c.reviewCycleDays * DAY) status = 'stale';
    out[c.id] = { status, count: live.length, latestAt: newest.created_at, validUntil };
  }
  return out;
}

export function employeeBand(n) {
  const e = Number(n) || 0;
  return e < 10 ? '1-9' : e < 50 ? '10-49' : e < 250 ? '50-249' : '250+';
}

// The ONLY organisation information that may be sent to an AI model: no names, emails, file contents or
// free-text evidence, and only the session's own organisation (enforced by the TenantRepo binding).
export function minimisedOrgContext(repo, controls) {
  const org = repo.organisation();
  const latest = latestAssessment(repo);
  const evidence = evidenceStatus(repo, controls);
  const openTasks = repo.list('tasks', { limit: 1000 }).filter((t) => t.status !== 'done');
  return {
    organisation: {
      sector: org.sector, employeeBand: employeeBand(org.employees), role: org.role,
      processesSensitiveData: Boolean(org.processes_sensitive), transfersDataAbroad: Boolean(org.transfers_abroad),
    },
    deterministicAssessment: latest
      ? { score: latest.score, risk: latest.risk, assessedAt: latest.createdAt.slice(0, 10), engine: latest.engineVersion,
          gaps: latest.gaps.map((g) => ({ controlId: g.controlId, priority: g.priority, answer: g.answer })) }
      : null,
    evidenceStatus: Object.fromEntries(Object.entries(evidence).map(([k, v]) => [k, v.status])),
    openTasksByControl: openTasks.reduce((acc, t) => { if (t.control_id) acc[t.control_id] = (acc[t.control_id] ?? 0) + 1; return acc; }, {}),
  };
}
