'use strict';
// Web client for the Zambia Compliance Intelligence Platform. No inline scripts or styles (strict CSP);
// every dynamic value is HTML-escaped with esc() before rendering.

const state = { me: null, view: 'dashboard', controls: [], chat: [], copilot: null, lastAnalysis: null, authTab: 'login' };
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const can = (perm) => Boolean(state.me?.permissions.includes(perm));
const prio = (p) => `<span class="badge ${p === 'high' ? 'high' : p === 'medium' ? 'med' : 'low'}">${esc(p)} priority</span>`;
const date = (iso) => (iso ? esc(String(iso).slice(0, 10)) : '—');

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function banner(msg, isError = false) {
  const b = $('#banner');
  if (!msg) { b.classList.add('hidden'); return; }
  b.textContent = msg;
  b.classList.toggle('error', isError);
  b.classList.remove('hidden');
  clearTimeout(banner.t);
  banner.t = setTimeout(() => b.classList.add('hidden'), isError ? 8000 : 4000);
}

function render(html) { $('#root').innerHTML = html; }

// ---------------- auth ----------------
function renderAuth() {
  $('#session').innerHTML = '';
  const t = state.authTab;
  render(`<div class="auth card">
    <div class="tabs">
      <button class="btn ${t === 'login' ? '' : 'secondary'}" data-action="auth-tab" data-tab="login">Sign in</button>
      <button class="btn ${t === 'register' ? '' : 'secondary'}" data-action="auth-tab" data-tab="register">Register organisation</button>
    </div>
    ${t === 'login' ? `
    <form data-form="login">
      <label for="l-email">Email</label><input id="l-email" name="email" type="email" required autocomplete="username">
      <label for="l-pw">Password</label><input id="l-pw" name="password" type="password" required autocomplete="current-password">
      <div class="actions"><button class="btn">Sign in</button></div>
    </form>` : t === 'mfa' ? `
    <form data-form="mfa">
      <p>Enter the 6-digit code from your authenticator app.</p>
      <label for="m-code">Verification code</label><input id="m-code" name="code" inputmode="numeric" pattern="[0-9]{6}" required autocomplete="one-time-code">
      <div class="actions"><button class="btn">Verify</button></div>
    </form>` : `
    <form data-form="register">
      <label for="r-name">Your name</label><input id="r-name" name="name" required>
      <label for="r-email">Email</label><input id="r-email" name="email" type="email" required autocomplete="username">
      <label for="r-pw">Password (12+ characters, letters and numbers)</label><input id="r-pw" name="password" type="password" minlength="12" required autocomplete="new-password">
      <h3>Organisation</h3>
      <label for="r-org">Entity name</label><input id="r-org" name="orgName" placeholder="Example: ABC Limited" required>
      <div class="row">
        <div><label for="r-sector">Sector</label><input id="r-sector" name="sector" placeholder="Mining, HR, Retail, Finance…"></div>
        <div><label for="r-emp">Employees</label><input id="r-emp" name="employees" type="number" min="0" placeholder="25"></div>
      </div>
      <label for="r-role">Role</label><select id="r-role" name="role"><option>Data Controller</option><option>Data Processor</option><option>Controller and Processor</option></select>
      <div class="actions"><button class="btn">Create account</button></div>
    </form>`}
  </div>`);
}

// ---------------- shell ----------------
const NAV = [
  ['Compliance', [['dashboard', 'Dashboard', 'org.read'], ['org', 'Organisation', 'org.read'], ['assessment', 'Assessment & Copilot', 'assessment.read'],
    ['evidence', 'Evidence', 'evidence.read'], ['tasks', 'Tasks', 'task.read'], ['documents', 'Document generator', 'document.generate']]],
  ['Intelligence', [['assistant', 'AI Assistant', 'ai.use'], ['docintel', 'Document intelligence', 'evidence.read'], ['insights', 'Insights & executive', 'insights.read'],
    ['regulatory', 'Regulatory updates', 'regulatory.read']]],
  ['Governance', [['kb', 'Legal knowledge base', null], ['governance', 'Regulatory review', 'kb.governance.read'], ['audit', 'Audit log', 'audit.read']]],
];

function canView(perm) { return perm === null ? (can('kb.read') || can('kb.governance.read')) : can(perm); }

function renderSession() {
  const me = state.me;
  const orgs = me.memberships.map((m) => `<option value="${esc(m.id)}" ${me.activeOrg?.id === m.id ? 'selected' : ''}>${esc(m.name)} (${esc(m.role)})</option>`).join('');
  $('#session').innerHTML = `${me.memberships.length ? `<select data-change="switch-org" aria-label="Organisation">${orgs}</select>` : ''}
    <span>${esc(me.user.name)}${me.user.platformRole !== 'user' ? ` · ${esc(me.user.platformRole.replace('_', ' '))}` : ''}</span>
    <button class="btn small secondary" data-action="logout">Sign out</button>`;
}

async function renderApp() {
  renderSession();
  const items = NAV.map(([group, entries]) => {
    const visible = entries.filter(([, , perm]) => canView(perm));
    if (!visible.length) return '';
    return `<div class="group">${esc(group)}</div>` + visible.map(([id, label]) => `<button data-action="nav" data-view="${id}" class="${state.view === id ? 'active' : ''}">${esc(label)}</button>`).join('');
  }).join('');
  render(`<div class="layout"><nav class="side" aria-label="Sections">${items}</nav><main id="main" class="card"><p class="muted">Loading…</p></main></div>`);
  const allowed = NAV.flatMap(([, e]) => e).filter(([, , p]) => canView(p)).map(([id]) => id);
  if (!allowed.includes(state.view)) state.view = allowed[0] ?? 'kb';
  $(`nav.side [data-view="${state.view}"]`)?.classList.add('active');
  try {
    if (!state.controls.length && (can('kb.read') || can('kb.governance.read'))) state.controls = await api('/api/controls');
    $('#main').innerHTML = await VIEWS[state.view]();
    AFTER[state.view]?.();
  } catch (err) {
    $('#main').innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

function main(html) { $('#main').innerHTML = html; }
const controlById = (id) => state.controls.find((c) => c.id === id);

// ---------------- views ----------------
const VIEWS = {
  async dashboard() {
    const [latest, insights, ai] = await Promise.all([api('/api/assessments/latest'), api('/api/insights'), api('/api/ai/status')]);
    const a = latest.assessment;
    if (!a) {
      return `<h2>Compliance dashboard</h2><p class="muted">Complete the assessment to see your score and action plan.</p>
        <div class="actions"><button class="btn" data-action="nav" data-view="assessment">Start assessment</button></div>${aiNote(ai)}`;
    }
    return `<h2>Compliance dashboard</h2>
      <div class="score"><div class="circle">${a.score}</div><div><h3>${esc(state.me.activeOrg.name)}</h3>
        <p>Screening result: <b>${esc(a.risk)} risk</b> ${insights.delta === null ? '' : `<span class="badge info">${insights.delta >= 0 ? '+' : ''}${insights.delta} since last assessment</span>`}</p>
        <p class="muted small">Deterministic score (engine ${esc(a.engineVersion)}), assessed ${date(a.createdAt)}. Not a legal certification.</p></div></div>
      <div class="kpis"><div class="kpi"><span>Score</span><b>${a.score}%</b></div><div class="kpi"><span>Gaps</span><b>${a.gaps.length}</b></div>
        <div class="kpi"><span>Open tasks</span><b>${insights.tasks.open}</b></div><div class="kpi"><span>Regulatory updates</span><b>${insights.openRegulatoryNotifications}</b></div></div>
      <h3>Top priorities</h3>
      ${insights.priorities.slice(0, 5).map((p, i) => `<div class="item">${prio(p.priority)} <span class="badge info">score ${p.score}</span><br><b>${i + 1}. ${esc(p.question)}</b>
        <br><span class="muted small">${esc(p.factors.join(' · '))}</span></div>`).join('') || '<p class="muted">No open priorities.</p>'}
      <h3>Signals</h3>${insights.patterns.map((p) => `<div class="item"><span class="badge ${p.severity === 'high' ? 'high' : 'med'}">${esc(p.severity)}</span> <b>${esc(p.title)}</b><br><span class="muted small">${esc(p.detail)}</span></div>`).join('') || '<p class="muted">No signals detected.</p>'}
      ${aiNote(ai)}`;
  },

  async org() {
    const o = await api('/api/org');
    const members = await api('/api/members');
    const edit = can('org.update');
    return `<h2>Organisation profile</h2>
      <form data-form="org">
        <div class="row">
          <div><label for="o-name">Entity name</label><input id="o-name" name="name" value="${esc(o.name)}" ${edit ? '' : 'disabled'}></div>
          <div><label for="o-sector">Sector</label><input id="o-sector" name="sector" value="${esc(o.sector)}" ${edit ? '' : 'disabled'}></div>
          <div><label for="o-emp">Employees</label><input id="o-emp" name="employees" type="number" min="0" value="${esc(o.employees)}" ${edit ? '' : 'disabled'}></div>
          <div><label for="o-role">Role</label><select id="o-role" name="role" ${edit ? '' : 'disabled'}>${['Data Controller', 'Data Processor', 'Controller and Processor'].map((r) => `<option ${o.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        </div>
        <label class="check"><input type="checkbox" name="processes_sensitive" ${o.processesSensitive ? 'checked' : ''} ${edit ? '' : 'disabled'}> We process sensitive personal data (health, biometric, etc.)</label>
        <label class="check"><input type="checkbox" name="transfers_abroad" ${o.transfersAbroad ? 'checked' : ''} ${edit ? '' : 'disabled'}> We transfer or store personal data outside Zambia</label>
        <p class="muted small">These flags drive contextual prioritisation. They never change the deterministic score.</p>
        ${edit ? '<div class="actions"><button class="btn">Save profile</button></div>' : ''}
      </form>
      <h3>Members</h3>
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
      ${members.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${can('member.manage') && m.id !== state.me.user.id
        ? `<select data-change="member-role" data-user="${esc(m.id)}">${['owner', 'admin', 'compliance_officer', 'contributor', 'viewer'].map((r) => `<option ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>`
        : esc(m.role)}</td></tr>`).join('')}</tbody></table>
      ${can('member.manage') ? `<form data-form="add-member"><div class="row"><div><label for="am-email">Add a registered user by email</label><input id="am-email" name="email" type="email" required></div>
        <div><label for="am-role">Role</label><select id="am-role" name="role"><option>viewer</option><option>contributor</option><option>compliance_officer</option><option>admin</option></select></div></div>
        <div class="actions"><button class="btn secondary">Add member</button></div></form>` : ''}
      <h3>Security</h3>
      <div id="mfa-area">${state.me.user.mfaEnabled ? '<p><span class="badge low">MFA enabled</span> Your account requires a verification code at sign-in.</p>'
        : '<p class="muted">Multi-factor authentication is not enabled for your account.</p><button class="btn secondary" data-action="mfa-setup">Enable MFA</button>'}</div>
      <h3>Add another organisation</h3>
      <form data-form="new-org"><div class="row"><div><label for="no-name">Entity name</label><input id="no-name" name="name" required></div>
        <div><label for="no-sector">Sector</label><input id="no-sector" name="sector"></div></div><div class="actions"><button class="btn secondary">Create organisation</button></div></form>`;
  },

  async assessment() {
    const latest = await api('/api/assessments/latest');
    const prev = latest.assessment?.answers ?? {};
    const editable = can('assessment.create');
    return `<h2>Compliance assessment</h2>
      <p class="muted">Answer based on the organisation's current position. This is a screening tool, not a legal opinion. Open the Copilot on any question for plain-language guidance, evidence expectations and sources.</p>
      <div class="split"><div><form data-form="assessment">
      ${state.controls.map((c) => `<div class="q"><p>${esc(c.question)}</p><div class="opts">
        ${['yes', 'partial', 'no'].map((v) => `<label><input type="radio" name="${esc(c.id)}" value="${v}" ${prev[c.id] === v ? 'checked' : ''} ${editable ? '' : 'disabled'}> ${v === 'yes' ? 'Yes' : v === 'partial' ? 'Partially' : 'No'}</label>`).join('')}
        ${prio(c.priority)} <button type="button" class="btn small secondary" data-action="copilot" data-control="${esc(c.id)}">Copilot</button></div></div>`).join('')}
      ${editable ? '<div class="actions"><button class="btn">Calculate compliance score</button></div>' : ''}
      </form></div><aside id="copilot" class="panel"><b>Compliance Copilot</b><p class="muted small">Select “Copilot” on a question.</p></aside></div>`;
  },

  async evidence() {
    const ev = await api('/api/evidence');
    return `<h2>Evidence</h2><p class="muted">Files are encrypted at rest and versioned. Link evidence to a control so the platform can track freshness.</p>
      ${can('evidence.upload') ? `<form data-form="evidence" class="panel">
        <div class="row"><div><label for="e-title">Title</label><input id="e-title" name="title" required></div>
          <div><label for="e-control">Control</label><select id="e-control" name="controlId"><option value="">— none —</option>${state.controls.map((c) => `<option value="${esc(c.id)}">${esc(c.requirementTitle)}</option>`).join('')}</select></div>
          <div><label for="e-valid">Valid until (optional)</label><input id="e-valid" name="validUntil" type="date"></div>
          <div><label for="e-sup">Replaces (new version of)</label><select id="e-sup" name="supersedes"><option value="">— new evidence —</option>${ev.items.map((i) => `<option value="${esc(i.id)}">${esc(i.title)} v${i.version}</option>`).join('')}</select></div></div>
        <label for="e-file">File (PDF, DOCX, XLSX, TXT, MD, CSV, HTML, PNG, JPG; max 5 MB)</label><input id="e-file" name="file" type="file" required>
        <div class="actions"><button class="btn">Upload evidence</button></div></form>` : ''}
      <h3>Evidence status by control</h3>
      <table><thead><tr><th>Control</th><th>Status</th><th>Items</th><th>Latest</th></tr></thead><tbody>
      ${state.controls.map((c) => { const s = ev.status[c.id]; return `<tr><td>${esc(c.requirementTitle)}</td><td>${statusBadge(s.status)}</td><td>${s.count}</td><td>${date(s.latestAt)}</td></tr>`; }).join('')}
      </tbody></table>
      <h3>Files</h3>
      <table><thead><tr><th>Title</th><th>Control</th><th>Version</th><th>Valid until</th><th>SHA-256</th><th></th></tr></thead><tbody>
      ${ev.items.map((i) => `<tr><td>${esc(i.title)}<br><span class="muted small">${esc(i.filename)}</span></td><td>${esc(controlById(i.controlId)?.requirementTitle ?? '—')}</td><td>v${i.version}</td>
        <td>${date(i.validUntil)}</td><td><code>${esc(i.sha256.slice(0, 16))}…</code></td><td><a href="/api/evidence/${esc(i.id)}/download">Download</a></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No evidence uploaded yet.</td></tr>'}
      </tbody></table>`;
  },

  async tasks() {
    const tasks = await api('/api/tasks');
    return `<h2>Remediation tasks</h2>
      ${can('task.create') ? `<form data-form="task" class="panel"><div class="row">
        <div><label for="t-title">Title</label><input id="t-title" name="title" required minlength="3"></div>
        <div><label for="t-control">Control</label><select id="t-control" name="controlId"><option value="">— none —</option>${state.controls.map((c) => `<option value="${esc(c.id)}">${esc(c.requirementTitle)}</option>`).join('')}</select></div>
        <div><label for="t-prio">Priority</label><select id="t-prio" name="priority"><option>high</option><option selected>medium</option><option>low</option></select></div>
        <div><label for="t-due">Due date</label><input id="t-due" name="dueDate" type="date"></div></div>
        <label for="t-desc">Description</label><textarea id="t-desc" name="description"></textarea>
        <div class="actions"><button class="btn">Create task</button></div></form>` : ''}
      <table><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Source</th><th>Status</th></tr></thead><tbody>
      ${tasks.map((t) => `<tr><td><b>${esc(t.title)}</b><br><span class="muted small">${esc(t.description)}</span></td><td>${prio(t.priority)}</td><td>${date(t.dueDate)}</td><td>${esc(t.source)}</td>
        <td>${can('task.update') ? `<select data-change="task-status" data-task="${esc(t.id)}">${['open', 'in_progress', 'done'].map((s) => `<option ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : esc(t.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No tasks yet.</td></tr>'}
      </tbody></table>`;
  },

  async documents() {
    const types = await api('/api/documents/types');
    return `<h2>Document generator</h2><p class="muted">Generates a structured starter document from your profile, latest assessment and approved sources. Legal review is required before use.</p>
      <form data-form="docgen"><div class="row"><div><label for="d-type">Document</label><select id="d-type" name="type">${types.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
      <div><label for="d-dpo">Contact / DPO name</label><input id="d-dpo" name="dpo" placeholder="Name or role"></div></div>
      <div class="actions"><button class="btn">Generate document</button></div></form><pre id="doc-output" class="doc hidden"></pre>`;
  },

  async assistant() {
    const ai = await api('/api/ai/status');
    return `<h2>AI Compliance Assistant</h2>
      <p class="muted">Answers are grounded in approved, version-controlled legal sources and your organisation's own data only. Every claim must cite a source; when sources are insufficient the assistant says so.</p>
      ${aiNote(ai)}
      <div id="chat" class="chat">${state.chat.map(renderMsg).join('')}</div>
      <form data-form="ask"><label for="a-q">Your question</label><textarea id="a-q" name="question" maxlength="2000" required placeholder="e.g. What evidence should we keep for breach management? Why is cross-border transfer high risk for us?"></textarea>
      <div class="actions"><button class="btn">Ask</button><span class="muted small">Personal data such as emails, phone and NRC numbers is redacted before any AI processing.</span></div></form>`;
  },

  async docintel() {
    const [ev, cl, analyses] = await Promise.all([api('/api/evidence'), api('/api/documents/checklists'), api('/api/documents/analyses')]);
    const analysable = ev.items.filter((i) => cl.analysableTypes.includes(i.mime));
    return `<h2>Document intelligence <span class="badge info">pilot</span></h2>
      <p class="muted">Analyse an uploaded policy or record against an approved checklist. Results are potential observations for human review — not legal determinations. Document content is treated as untrusted data.</p>
      ${can('document.analyse') ? `<form data-form="analyse" class="panel"><div class="row">
        <div><label for="di-ev">Document (TXT, MD, CSV, HTML, DOCX)</label><select id="di-ev" name="evidenceId" required>${analysable.map((i) => `<option value="${esc(i.id)}" ${state.lastAnalysis?.evidenceId === i.id ? 'selected' : ''}>${esc(i.title)} — ${esc(i.filename)}</option>`).join('') || '<option value="">Upload a document in Evidence first</option>'}</select></div>
        <div><label for="di-cl">Checklist</label><select id="di-cl" name="checklist">${cl.checklists.map((c) => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('')}</select></div></div>
        <div class="actions"><button class="btn" ${analysable.length ? '' : 'disabled'}>Analyse document</button></div></form>` : ''}
      <div id="analysis">${state.lastAnalysis ? renderAnalysis(state.lastAnalysis) : ''}</div>
      <h3>Previous analyses</h3>
      ${analyses.map((a) => `<div class="item"><b>${esc(a.checklistLabel)}</b> · ${date(a.createdAt)} · ${a.findings.filter((f) => f.status !== 'covered').length} potential gap(s)
        ${a.securityFlags.length ? '<span class="badge high">security flags</span>' : ''} <button class="btn small secondary" data-action="open-analysis" data-id="${esc(a.id)}">Open</button></div>`).join('') || '<p class="muted">No analyses yet.</p>'}`;
  },

  async insights() {
    const i = await api('/api/insights');
    return `<h2>Risk insights</h2><p class="muted">Pattern analysis and prioritisation are rule-based and explainable. The deterministic score remains authoritative.</p>
      <h3>Compliance trend</h3>${sparkline(i.trend)}
      <div class="kpis"><div class="kpi"><span>Evidence missing</span><b>${i.evidenceSummary.missing ?? 0}</b></div><div class="kpi"><span>Evidence expired</span><b>${i.evidenceSummary.expired ?? 0}</b></div>
        <div class="kpi"><span>Overdue tasks</span><b>${i.tasks.overdue}</b></div><div class="kpi"><span>Assessments</span><b>${i.trend.length}</b></div></div>
      <h3>Contextual priorities</h3>
      <table><thead><tr><th>Control</th><th>Answer</th><th>Evidence</th><th>Priority score</th><th>Why</th></tr></thead><tbody>
      ${i.priorities.map((p) => `<tr><td>${prio(p.priority)}<br>${esc(p.question)}</td><td>${esc(p.answer)}</td><td>${statusBadge(p.evidence)}</td><td><b>${p.score}</b></td><td class="small">${esc(p.factors.join('; '))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No priorities.</td></tr>'}
      </tbody></table>
      <h3>Signals</h3>${i.patterns.map((p) => `<div class="item"><span class="badge ${p.severity === 'high' ? 'high' : 'med'}">${esc(p.severity)}</span> <b>${esc(p.title)}</b><br><span class="muted small">${esc(p.detail)} Controls: ${esc(p.controlIds.map((c) => controlById(c)?.requirementTitle ?? c).join(', '))}</span></div>`).join('') || '<p class="muted">No signals detected.</p>'}
      ${can('insights.executive') ? `<h3>Executive summary</h3><button class="btn secondary" data-action="exec-summary">Generate management summary</button><div id="exec"></div>` : ''}`;
  },

  async regulatory() {
    const notes = await api('/api/regulatory/notifications');
    return `<h2>Regulatory updates</h2><p class="muted">Only updates validated by a legal reviewer reach your organisation. Each lists the controls that may be affected.</p>
      ${notes.map((n) => `<div class="item"><span class="badge ${n.status === 'open' ? 'high' : 'low'}">${esc(n.status)}</span> <span class="badge info">${esc(n.change?.significance ?? '')} significance</span>
        <b>${esc(n.change?.title ?? 'Update')}</b><br><span class="muted small">Reviewed ${date(n.change?.reviewedAt)} · Affected controls: ${esc(n.affectedControls.map((c) => controlById(c)?.requirementTitle ?? c).join(', '))}</span>
        ${n.change?.reviewNote ? `<br><span class="small">Reviewer note: ${esc(n.change.reviewNote)}</span>` : ''}
        ${n.status === 'open' && can('regulatory.acknowledge') ? `<div class="actions"><button class="btn small" data-action="ack" data-id="${esc(n.id)}" data-tasks="1">Acknowledge &amp; create review tasks</button>
          <button class="btn small secondary" data-action="ack" data-id="${esc(n.id)}" data-tasks="0">Acknowledge only</button></div>` : ''}</div>`).join('') || '<p class="muted">No regulatory updates.</p>'}`;
  },

  async kb() {
    const [sources, reqs] = await Promise.all([api('/api/kb/sources'), api('/api/kb/requirements')]);
    return `<h2>Legal knowledge base</h2>
      <p class="muted">Version-controlled sources. Only <b>approved, current</b> versions are retrievable by the AI. Pilot-baseline entries are summaries whose references must be verified by a qualified legal reviewer.</p>
      <form data-form="kb-search"><label for="kb-q">Search approved sources</label><div class="actions"><input id="kb-q" name="q" placeholder="e.g. breach notification"><button class="btn secondary">Search</button></div></form>
      <div id="kb-results"></div>
      <h3>Sources & versions</h3>
      ${sources.map((s) => `<div class="item"><b>${esc(s.title)}</b> <span class="muted small">${esc(s.issuer)} · ${esc(s.source_type)} · <code>${esc(s.id)}</code></span>
        ${s.versions.map((v) => `<div class="small">${v.isCurrent ? '<span class="badge low">current</span>' : ''}<span class="badge ${v.status === 'approved' ? 'low' : v.status === 'pending_review' ? 'med' : 'info'}">${esc(v.status)}</span>
          ${v.pilotBaseline ? '<span class="badge med">pilot summary</span>' : ''} ${esc(v.versionLabel)} · ${v.sectionCount} sections · reviewed by ${esc(v.reviewedBy ?? '—')}
          <button class="btn small secondary" data-action="view-version" data-id="${esc(v.id)}">View</button>
          ${v.status === 'pending_review' && can('kb.review') ? `<button class="btn small" data-action="review-version" data-id="${esc(v.id)}" data-decision="approve">Approve</button>
            <button class="btn small danger" data-action="review-version" data-id="${esc(v.id)}" data-decision="reject">Reject</button>` : ''}</div>`).join('')}</div>`).join('')}
      <div id="version-view"></div>
      <h3>Requirements map</h3>
      <table><thead><tr><th>Code</th><th>Requirement</th><th>Sources</th><th>Applies</th></tr></thead><tbody>
      ${reqs.map((r) => `<tr><td><code>${esc(r.code)}</code></td><td><b>${esc(r.title)}</b><br><span class="small muted">${esc(r.obligation)}</span></td>
        <td class="small">${esc(r.sourceRefs.map((x) => x.ref).join('; '))}</td><td class="small">${r.applicability.always ? 'All organisations' : `If ${esc(r.applicability.orgFlag)}`}</td></tr>`).join('')}
      </tbody></table>`;
  },

  async governance() {
    const [changes, sources] = await Promise.all([api('/api/governance/changes'), api('/api/kb/sources')]);
    return `<h2>Regulatory change review</h2>
      <p class="muted">Captured updates are compared with the current approved version. A legal reviewer — not the person who captured it — validates significance and affected requirements before anything is published.</p>
      ${can('regulatory.capture') ? `<form data-form="capture" class="panel">
        <div class="row"><div><label for="c-src">Source</label><select id="c-src" name="sourceId">${sources.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select></div>
        <div><label for="c-title">Update title</label><input id="c-title" name="title" required></div></div>
        <label for="c-url">Official source URL (optional; allow-listed hosts only)</label><input id="c-url" name="url" placeholder="https://www.dpc.gov.zm/…">
        <label for="c-text">Captured text — start each amended or new section with a line like <code>[DPA 2021 — Breach notification] Heading</code>. Use <code>[REPEALED]</code> as the body to remove a section.</label>
        <textarea id="c-text" name="text" rows="8"></textarea>
        <div class="actions"><button class="btn">Capture update</button></div></form>` : ''}
      <h3>Changes</h3>
      ${changes.map((c) => `<div class="item"><span class="badge ${c.status === 'detected' ? 'med' : c.status === 'validated' ? 'low' : 'info'}">${esc(c.status)}</span> <b>${esc(c.title)}</b>
        <span class="muted small">captured ${date(c.capturedAt)} · ${esc(c.origin)} · sha256 <code>${esc(c.capturedSha256.slice(0, 12))}…</code></span>
        <div class="small">Diff: ${c.diff.modified.length} modified, ${c.diff.added.length} added, ${c.diff.repealed.length} repealed, ${c.diff.unchanged.length} unchanged
          ${c.diff.securityFlags?.length ? '<span class="badge high">instruction-like text detected</span>' : ''}</div>
        <button class="btn small secondary" data-action="open-change" data-id="${esc(c.id)}">Open</button></div>`).join('') || '<p class="muted">No captured changes.</p>'}
      <div id="change-view"></div>`;
  },

  async audit() {
    const [log, chain] = await Promise.all([api('/api/audit'), api('/api/audit/verify')]);
    return `<h2>Audit log</h2><p>${chain.valid ? `<span class="badge low">hash chain verified</span> ${chain.entries} entries` : `<span class="badge high">hash chain broken</span> at ${esc(chain.brokenAt)}`}</p>
      <table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${log.map((a) => `<tr><td class="small">${esc(a.createdAt.replace('T', ' ').slice(0, 19))}</td><td>${esc(a.user ?? '—')}</td><td><code>${esc(a.action)}</code></td><td class="small">${esc(JSON.stringify(a.metadata))}</td></tr>`).join('')}
      </tbody></table>`;
  },
};

const AFTER = {
  assessment() { if (state.copilot) showCopilot(state.copilot); },
};

// ---------------- render helpers ----------------
function aiNote(ai) {
  return `<p class="small"><span class="badge ${ai.live ? 'low' : 'info'}">${ai.live ? 'model' : 'deterministic mode'}</span> ${esc(ai.note)}</p>`;
}

function statusBadge(s) {
  const cls = { current: 'low', missing: 'high', expired: 'high', expiring: 'med', stale: 'med' }[s] ?? 'info';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

function renderSources(sources) {
  return sources.map((s) => `<div class="source small"><b>[${esc(s.id)}] ${esc(s.heading)}</b> — ${esc(s.sourceTitle)}, ${esc(s.ref)}
    ${s.referenceVerified ? '' : '<span class="badge med">pilot summary · verify reference</span>'}<br><span class="muted">${esc(s.text)}</span></div>`).join('');
}

function renderMsg(m) {
  if (m.role === 'user') return `<div class="msg user">${esc(m.text)}</div>`;
  const flags = (m.flags ?? []).map((f) => `<span class="badge info">${esc(f.id)}</span>`).join('');
  return `<div class="msg ai">${m.blocked ? '<span class="badge high">blocked</span> ' : ''}${m.insufficient && !m.blocked ? '<span class="badge med">insufficient sources</span> ' : ''}${m.blocked ? '' : `<span class="badge info">${esc(m.mode)}</span> `}<span class="badge ${m.confidence === 'high' ? 'low' : 'med'}">confidence: ${esc(m.confidence)}</span>
    <div>${esc(m.text)}</div>${m.sources?.length ? `<div><b class="small">Sources</b>${renderSources(m.sources)}</div>` : ''}${flags ? `<div class="small">Controls applied: ${flags}</div>` : ''}</div>`;
}

function renderAnalysis(a) {
  return `<h3>${esc(a.checklistLabel)} — findings</h3>
    ${a.securityFlags.length ? `<div class="panel small"><b>Security flags</b> — instruction-like or unusual content was found and treated as data:<br>${a.securityFlags.map((f) => `<span class="badge high">${esc(f.id)}</span> “${esc(f.excerpt)}”`).join('<br>')}</div>` : ''}
    <p class="small muted">${a.aiUsed ? 'Model observations were added to the rule-based checklist.' : 'Rule-based checklist analysis (no model observations).'}</p>
    <table><thead><tr><th>Item</th><th>Status</th><th>Observation</th><th>Review</th></tr></thead><tbody>
    ${a.findings.map((f) => `<tr><td>${esc(f.label)}</td><td><span class="badge ${f.status === 'covered' ? 'low' : f.status === 'needs_review' ? 'med' : 'high'}">${esc(f.status.replace('_', ' '))}</span></td>
      <td class="small">${esc(f.observation)}${f.excerpt ? `<br><span class="muted">“${esc(f.excerpt)}”</span>` : ''}${f.aiNote ? `<br><i>AI (${esc(f.aiNote.assessment)}): ${esc(f.aiNote.note)}</i>` : ''}</td>
      <td>${f.review.status === 'pending' && can('finding.review')
        ? `<button class="btn small" data-action="review-finding" data-analysis="${esc(a.id)}" data-finding="${esc(f.id)}" data-decision="accept">Accept → task</button>
           <button class="btn small secondary" data-action="review-finding" data-analysis="${esc(a.id)}" data-finding="${esc(f.id)}" data-decision="dismiss">Dismiss</button>`
        : esc(f.review.status.replace('_', ' '))}</td></tr>`).join('')}
    </tbody></table>`;
}

function sparkline(trend) {
  if (trend.length === 0) return '<p class="muted">No assessments yet.</p>';
  const w = 600, h = 120, pad = 20;
  const pts = trend.map((t, i) => [pad + (trend.length === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (trend.length - 1)), h - pad - (t.score / 100) * (h - 2 * pad)]);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Score trend">
    ${[0, 50, 100].map((v) => { const y = h - pad - (v / 100) * (h - 2 * pad); return `<line class="grid" x1="${pad}" x2="${w - pad}" y1="${y}" y2="${y}"></line><text x="2" y="${y + 3}">${v}</text>`; }).join('')}
    <polyline class="line" points="${pts.map((p) => p.join(',')).join(' ')}"></polyline>
    ${pts.map((p, i) => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="3"><title>${esc(trend[i].date.slice(0, 10))}: ${trend[i].score}%</title></circle>`).join('')}</svg>`;
}

function showCopilot(g) {
  const el = $('#copilot');
  if (!el) return;
  el.innerHTML = `<b>Compliance Copilot</b>
    <p class="small"><b>${esc(g.control.requirementTitle)}</b> ${prio(g.control.priority)}</p>
    <p class="small">${esc(g.control.plainLanguage)}</p>
    <p class="small"><b>Why it matters:</b> ${esc(g.whyItMatters)}</p>
    <p class="small"><b>Status:</b> answer <i>${esc(g.status.answer)}</i>, evidence ${statusBadge(g.status.evidence.status)}</p>
    <p class="small"><b>Evidence that may demonstrate it:</b></p><ul class="small">${g.control.evidenceExpectations.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    <p class="small"><b>Next step:</b> ${esc(g.nextAction.text)}</p>
    ${g.suggestedTask && can('task.create') ? `<button class="btn small" data-action="accept-copilot-task" data-control="${esc(g.control.id)}">Create task (due ${esc(g.suggestedTask.dueDate)})</button>` : ''}
    ${can('ai.use') ? `<button class="btn small secondary" data-action="copilot-ask" data-control="${esc(g.control.id)}">Explain with sources</button>` : ''}
    <div id="copilot-answer"></div>
    <details class="small"><summary>Approved sources (${g.sources.length})</summary>${renderSources(g.sources)}</details>`;
}

function formData(form) {
  const fd = new FormData(form);
  return Object.fromEntries([...fd.entries()].filter(([, v]) => !(v instanceof File)));
}

const EXT_MIME = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', html: 'text/html', htm: 'text/html', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

// ---------------- form handlers ----------------
const FORMS = {
  async login(f) {
    const d = formData(f);
    const out = await api('/api/auth/login', { method: 'POST', body: { email: d.email, password: d.password } });
    if (out.mfaRequired) { state.authTab = 'mfa'; renderAuth(); return; }
    await boot();
  },
  async mfa(f) { await api('/api/auth/mfa/verify', { method: 'POST', body: { code: formData(f).code } }); await boot(); },
  async register(f) {
    const d = formData(f);
    await api('/api/auth/register', { method: 'POST', body: { name: d.name, email: d.email, password: d.password,
      organisation: { name: d.orgName, sector: d.sector || undefined, employees: d.employees === '' ? undefined : Number(d.employees), role: d.role } } });
    state.view = 'org';
    await boot();
  },
  async org(f) {
    const d = formData(f);
    await api('/api/org', { method: 'PATCH', body: { name: d.name, sector: d.sector, employees: d.employees === '' ? undefined : Number(d.employees), role: d.role,
      processes_sensitive: f.elements.processes_sensitive.checked, transfers_abroad: f.elements.transfers_abroad.checked } });
    banner('Profile saved.');
    await refreshMe();
  },
  async 'add-member'(f) { await api('/api/members', { method: 'POST', body: formData(f) }); banner('Member added.'); await renderApp(); },
  async 'new-org'(f) { const d = formData(f); await api('/api/orgs', { method: 'POST', body: { name: d.name, sector: d.sector || undefined } }); banner('Organisation created.'); state.controls = []; await refreshMe(); },
  async 'mfa-enable'(f) { await api('/api/auth/mfa/enable', { method: 'POST', body: { code: formData(f).code } }); banner('MFA enabled.'); await refreshMe(); },
  async assessment(f) {
    const answers = {};
    for (const c of state.controls) { const x = f.querySelector(`input[name="${CSS.escape(c.id)}"]:checked`); if (x) answers[c.id] = x.value; }
    await api('/api/assessments', { method: 'POST', body: { answers } });
    banner('Assessment saved. Score calculated by the deterministic engine.');
    state.view = 'dashboard'; await renderApp();
  },
  async evidence(f) {
    const file = f.elements.file.files[0];
    if (!file) throw new Error('Choose a file');
    const ext = file.name.split('.').pop().toLowerCase();
    const mime = EXT_MIME[ext];
    if (!mime) throw new Error('Unsupported file type');
    const d = formData(f);
    await api('/api/evidence', { method: 'POST', body: { title: d.title, controlId: d.controlId || undefined, validUntil: d.validUntil || undefined,
      supersedes: d.supersedes || undefined, filename: file.name, mime, contentBase64: await readFileBase64(file) } });
    banner('Evidence uploaded and encrypted.'); await renderApp();
  },
  async task(f) {
    const d = formData(f);
    await api('/api/tasks', { method: 'POST', body: { title: d.title, description: d.description, controlId: d.controlId || undefined, priority: d.priority, dueDate: d.dueDate || undefined } });
    banner('Task created.'); await renderApp();
  },
  async docgen(f) {
    const out = await api('/api/documents/generate', { method: 'POST', body: formData(f) });
    const pre = $('#doc-output'); pre.textContent = out.text; pre.classList.remove('hidden');
  },
  async ask(f) {
    const question = formData(f).question.trim();
    if (!question) return;
    state.chat.push({ role: 'user', text: question });
    $('#chat').innerHTML = state.chat.map(renderMsg).join('') + '<div class="msg ai muted">Retrieving approved sources…</div>';
    try {
      const out = await api('/api/assistant/ask', { method: 'POST', body: { question } });
      state.chat.push({ role: 'ai', text: out.answer, sources: out.sources, flags: out.flags, mode: out.mode, confidence: out.confidence, insufficient: out.insufficientSources, blocked: out.blocked });
    } catch (err) {
      state.chat.push({ role: 'ai', text: err.message, mode: 'error', confidence: 'low' });
    }
    $('#chat').innerHTML = state.chat.map(renderMsg).join('');
    f.reset();
  },
  async analyse(f) {
    state.lastAnalysis = await api('/api/documents/analyse', { method: 'POST', body: formData(f) });
    await renderApp();
  },
  async 'kb-search'(f) {
    const q = formData(f).q.trim();
    const hits = q ? await api(`/api/kb/search?q=${encodeURIComponent(q)}`) : [];
    $('#kb-results').innerHTML = hits.length ? renderSources(hits) : '<p class="muted small">No approved source matched strongly enough.</p>';
  },
  async capture(f) {
    const d = formData(f);
    await api('/api/governance/changes', { method: 'POST', body: { sourceId: d.sourceId, title: d.title, text: d.text || undefined, url: d.url || undefined } });
    banner('Update captured. It awaits review by a legal reviewer.'); await renderApp();
  },
  async 'review-change'(f) {
    const d = formData(f);
    const codes = [...f.querySelectorAll('input[name="req"]:checked')].map((x) => x.value);
    const out = await api(`/api/governance/changes/${encodeURIComponent(f.dataset.id)}/review`, { method: 'POST',
      body: { decision: d.decision, significance: d.significance, requirementCodes: codes, versionLabel: d.versionLabel || undefined, note: d.note || undefined } });
    banner(out.status === 'validated' ? `Validated and published. ${out.notified} organisation(s) notified.` : 'Change rejected.');
    await renderApp();
  },
};

// ---------------- click actions ----------------
const ACTIONS = {
  'auth-tab': (el) => { state.authTab = el.dataset.tab; renderAuth(); },
  nav: async (el) => { state.view = el.dataset.view; await renderApp(); },
  logout: async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); state.me = null; state.chat = []; state.controls = []; state.authTab = 'login'; renderAuth(); },
  'mfa-setup': async () => {
    const out = await api('/api/auth/mfa/setup', { method: 'POST', body: {} });
    $('#mfa-area').innerHTML = `<p class="small">Add this secret to your authenticator app (TOTP, 6 digits, 30 seconds):</p><p><code>${esc(out.secret)}</code></p>
      <p class="small muted">or use the URI: <code>${esc(out.otpauthUri)}</code></p>
      <form data-form="mfa-enable"><label for="mf-code">Enter the current code to confirm</label><input id="mf-code" name="code" inputmode="numeric" pattern="[0-9]{6}" required>
      <div class="actions"><button class="btn">Enable MFA</button></div></form>`;
  },
  copilot: async (el) => { state.copilot = await api(`/api/copilot/${encodeURIComponent(el.dataset.control)}`); showCopilot(state.copilot); },
  'accept-copilot-task': async (el) => {
    await api(`/api/copilot/${encodeURIComponent(el.dataset.control)}/accept-task`, { method: 'POST', body: {} });
    banner('Task created from Copilot suggestion.');
  },
  'copilot-ask': async (el) => {
    const c = controlById(el.dataset.control);
    $('#copilot-answer').innerHTML = '<p class="muted small">Retrieving approved sources…</p>';
    const out = await api('/api/assistant/ask', { method: 'POST', body: { question: `What does this requirement mean and what evidence should we maintain? ${c.question}`, controlId: c.id } });
    $('#copilot-answer').innerHTML = renderMsg({ role: 'ai', text: out.answer, sources: [], flags: out.flags, mode: out.mode, confidence: out.confidence, insufficient: out.insufficientSources });
  },
  'exec-summary': async () => {
    $('#exec').innerHTML = '<p class="muted small">Generating…</p>';
    const out = await api('/api/insights/executive-summary', { method: 'POST', body: {} });
    $('#exec').innerHTML = `<div class="panel"><span class="badge info">${esc(out.mode)}</span><p>${esc(out.summary)}</p>
      ${out.keyRisks.length ? `<b class="small">Key risks</b><ul class="small">${out.keyRisks.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${out.flags.length ? `<p class="small">Controls applied: ${out.flags.map((f) => `<span class="badge info">${esc(f.id)}</span>`).join('')}</p>` : ''}</div>`;
  },
  ack: async (el) => {
    const out = await api(`/api/regulatory/notifications/${encodeURIComponent(el.dataset.id)}/acknowledge`, { method: 'POST', body: { createTasks: el.dataset.tasks === '1' } });
    banner(`Acknowledged${out.tasks.length ? `; ${out.tasks.length} review task(s) created` : ''}.`); await renderApp();
  },
  'open-analysis': async (el) => { state.lastAnalysis = await api(`/api/documents/analyses/${encodeURIComponent(el.dataset.id)}`); $('#analysis').innerHTML = renderAnalysis(state.lastAnalysis); },
  'review-finding': async (el) => {
    const out = await api(`/api/documents/analyses/${encodeURIComponent(el.dataset.analysis)}/findings/${encodeURIComponent(el.dataset.finding)}/review`,
      { method: 'POST', body: { decision: el.dataset.decision } });
    banner(out.task ? 'Finding accepted; remediation task created.' : 'Finding dismissed.');
    state.lastAnalysis = await api(`/api/documents/analyses/${encodeURIComponent(el.dataset.analysis)}`);
    $('#analysis').innerHTML = renderAnalysis(state.lastAnalysis);
  },
  'view-version': async (el) => {
    const v = await api(`/api/kb/versions/${encodeURIComponent(el.dataset.id)}`);
    $('#version-view').innerHTML = `<div class="panel"><b>${esc(v.versionLabel)}</b> <span class="badge info">${esc(v.status)}</span> <span class="small muted">sha256 <code>${esc(v.contentSha256.slice(0, 16))}…</code></span>
      ${v.sections.map((s) => `<div class="source small"><b>${esc(s.ref)} — ${esc(s.heading)}</b> ${s.reference_verified ? '<span class="badge low">verified</span>' : '<span class="badge med">unverified reference</span>'}<br>${esc(s.body)}</div>`).join('')}</div>`;
    $('#version-view').scrollIntoView({ behavior: 'smooth' });
  },
  'review-version': async (el) => {
    await api(`/api/kb/versions/${encodeURIComponent(el.dataset.id)}/review`, { method: 'POST', body: { decision: el.dataset.decision } });
    banner(`Version ${el.dataset.decision === 'approve' ? 'approved and now current' : 'rejected'}.`); await renderApp();
  },
  'open-change': async (el) => {
    const [c, reqs] = await Promise.all([api(`/api/governance/changes/${encodeURIComponent(el.dataset.id)}`), api('/api/kb/requirements')]);
    const suggested = new Set(c.suggestedRequirements.map((s) => s.code));
    const block = (title, list, render) => (list.length ? `<h3>${title}</h3>${list.map(render).join('')}` : '');
    $('#change-view').innerHTML = `<div class="panel"><b>${esc(c.title)}</b> <span class="badge info">${esc(c.status)}</span>
      ${c.diff.securityFlags?.length ? `<p class="small"><span class="badge high">instruction-like text</span> ${esc(c.diff.securityFlags.map((f) => f.excerpt).join(' | '))}</p>` : ''}
      ${block('Modified', c.diff.modified, (d) => `<div class="source small"><b>${esc(d.ref)}</b><br><span class="muted">Before: ${esc(d.oldBody)}</span><br>After: ${esc(d.newBody)}</div>`)}
      ${block('Added', c.diff.added, (d) => `<div class="source small"><b>${esc(d.ref)} — ${esc(d.heading)}</b><br>${esc(d.newBody)}</div>`)}
      ${block('Repealed', c.diff.repealed, (d) => `<div class="source small"><b>${esc(d.ref)}</b><br><span class="muted">${esc(d.oldBody)}</span></div>`)}
      ${c.status === 'detected' && can('regulatory.review') ? `<form data-form="review-change" data-id="${esc(c.id)}">
        <h3>Affected requirements</h3><p class="small muted">Suggestions are pre-selected; confirm or adjust.</p>
        ${reqs.map((r) => `<label class="check"><input type="checkbox" name="req" value="${esc(r.code)}" ${suggested.has(r.code) ? 'checked' : ''}> <code>${esc(r.code)}</code> ${esc(r.title)}
          ${suggested.has(r.code) ? `<span class="badge info">${esc(c.suggestedRequirements.find((s) => s.code === r.code).reason)}</span>` : ''}</label>`).join('')}
        <div class="row"><div><label for="rc-sig">Significance</label><select id="rc-sig" name="significance"><option>low</option><option selected>medium</option><option>high</option></select></div>
          <div><label for="rc-label">New version label</label><input id="rc-label" name="versionLabel" placeholder="e.g. Amended 2026"></div></div>
        <label for="rc-note">Reviewer note</label><textarea id="rc-note" name="note"></textarea>
        <div class="actions"><button class="btn" name="decision" value="validate">Validate &amp; publish</button><button class="btn danger" name="decision" value="reject">Reject</button></div>
      </form>` : `<p class="small muted">${c.status === 'detected' ? 'Awaiting a legal reviewer.' : `Reviewed ${date(c.reviewedAt)}${c.significance ? ` · significance ${esc(c.significance)}` : ''}`}</p>`}</div>`;
    $('#change-view').scrollIntoView({ behavior: 'smooth' });
  },
};

// ---------------- change handlers ----------------
const CHANGES = {
  'switch-org': async (el) => { await api('/api/auth/switch-org', { method: 'POST', body: { orgId: el.value } }); state.chat = []; state.copilot = null; state.lastAnalysis = null; await refreshMe(); },
  'task-status': async (el) => { await api(`/api/tasks/${encodeURIComponent(el.dataset.task)}`, { method: 'PATCH', body: { status: el.value } }); banner('Task updated.'); },
  'member-role': async (el) => { await api(`/api/members/${encodeURIComponent(el.dataset.user)}`, { method: 'PATCH', body: { role: el.value } }); banner('Role updated.'); },
};

// ---------------- wiring ----------------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !ACTIONS[el.dataset.action]) return;
  e.preventDefault();
  el.disabled = true;
  try { await ACTIONS[el.dataset.action](el); } catch (err) { banner(err.message, true); if (err.status === 401) await boot(); } finally { el.disabled = false; }
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form || !FORMS[form.dataset.form]) return;
  e.preventDefault();
  // Carry the clicked submit button's name/value (used by the change-review form).
  if (e.submitter?.name) {
    let hidden = form.querySelector(`input[type="hidden"][name="${CSS.escape(e.submitter.name)}"]`);
    if (!hidden) { hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = e.submitter.name; form.appendChild(hidden); }
    hidden.value = e.submitter.value;
  }
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((b) => { b.disabled = true; });
  try { await FORMS[form.dataset.form](form); } catch (err) { banner(err.message, true); } finally { buttons.forEach((b) => { b.disabled = false; }); }
});

document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-change]');
  if (!el || !CHANGES[el.dataset.change]) return;
  try { await CHANGES[el.dataset.change](el); } catch (err) { banner(err.message, true); await renderApp(); }
});

async function refreshMe() { state.me = await api('/api/auth/me'); await renderApp(); }

async function boot() {
  try {
    const status = await api('/api/auth/status');
    if (!status.authenticated) {
      state.me = null;
      state.authTab = status.mfaPending ? 'mfa' : (state.authTab === 'register' ? 'register' : 'login');
      renderAuth();
      return;
    }
    state.me = await api('/api/auth/me');
    await renderApp();
  } catch (err) {
    if (err.status === 401) { state.me = null; state.authTab = 'login'; renderAuth(); }
    else render(`<p class="muted">${esc(err.message)}</p>`);
  }
}

boot();
