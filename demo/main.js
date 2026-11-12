// Browser demo entry: installs the in-page API, then loads the real web client unchanged.
import { DEMO_PASSWORD, resetDemo, evidenceContent } from './mock-api.js';
import '../web/app.js';

const ACCOUNTS = [
  ['owner@acme.example', 'Acme owner'],
  ['staff@acme.example', 'Acme contributor'],
  ['owner@zedhealth.example', 'ZedHealth owner'],
  ['admin@platform.example', 'Platform admin'],
  ['reviewer@platform.example', 'Legal reviewer'],
];

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mountBar() {
  const bar = document.createElement('section');
  bar.className = 'demo-bar';
  bar.setAttribute('aria-label', 'Demo controls');
  bar.innerHTML = `<div class="demo-inner">
    <p><b>Browser demo.</b> Everything runs in this page and your data stays in this browser. AI features use the built-in source-quoting mode.
      All demo accounts use the password <code>${esc(DEMO_PASSWORD)}</code>.</p>
    <div class="demo-actions"><span class="small">Sign in as:</span>
      ${ACCOUNTS.map(([email, label]) => `<button type="button" class="btn small secondary" data-demo-login="${esc(email)}">${esc(label)}</button>`).join('')}
      <button type="button" class="btn small danger" data-demo-reset>Reset demo data</button></div></div>`;
  document.querySelector('.topbar').after(bar);
}

const viewer = document.createElement('div');
viewer.className = 'demo-viewer';
viewer.hidden = true;
viewer.setAttribute('role', 'dialog');
viewer.setAttribute('aria-modal', 'true');
viewer.setAttribute('aria-label', 'Evidence file');

async function signInAs(email) {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: DEMO_PASSWORD }) });
  if (res.ok) location.reload();
}

document.addEventListener('click', async (e) => {
  const login = e.target.closest('[data-demo-login]');
  if (login) { e.preventDefault(); await signInAs(login.dataset.demoLogin); return; }
  if (e.target.closest('[data-demo-reset]')) { e.preventDefault(); await resetDemo(); location.reload(); return; }
  if (e.target.closest('[data-demo-close]')) { viewer.hidden = true; return; }
  const link = e.target.closest('a[href^="/api/evidence/"]');
  if (link) {
    e.preventDefault();
    e.stopPropagation();
    const id = link.getAttribute('href').split('/')[3];
    const file = await evidenceContent(id);
    if (!file) return;
    viewer.innerHTML = `<div class="demo-viewer-card"><div class="demo-viewer-head"><b>${esc(file.filename)}</b>
      <button type="button" class="btn small secondary" data-demo-close>Close</button></div>
      <p class="small muted">${esc(file.mime)} · ${file.size} bytes · SHA-256 <code>${esc(file.sha256.slice(0, 16))}…</code></p>
      ${file.text !== null ? `<pre class="doc">${esc(file.text)}</pre>` : '<p class="muted">Binary files cannot be previewed in the browser demo.</p>'}</div>`;
    viewer.hidden = false;
  }
}, true);

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') viewer.hidden = true; });

mountBar();
document.body.appendChild(viewer);
