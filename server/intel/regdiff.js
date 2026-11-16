// Regulatory capture parsing, diffing and merging (pure; shared with the browser demo).
import { tokenize } from '../kb/retrieval.js';

export const REPEALED = /^\s*\[?\s*repealed\s*\]?\s*\.?\s*$/i;

// Capture format: each amended/new section starts with a line "[Reference] Heading", followed by its body.
// A body of "[REPEALED]" removes the section. Text without markers becomes one section named after the title.
export function parseCapturedSections(text, title) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = /^\s*(?:#{1,3}\s*)?\[([^\]]{1,200})\]\s*(.*)$/.exec(line);
    if (m && m[1].trim().toUpperCase() !== 'REPEALED') {
      if (cur) sections.push(cur);
      cur = { ref: m[1].trim(), heading: (m[2] || m[1]).trim(), body: '' };
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line;
    } else if (line.trim()) {
      cur = { ref: title, heading: title, body: line };
    }
  }
  if (cur) sections.push(cur);
  return sections.map((s) => ({ ...s, body: s.body.trim() })).filter((s) => s.body);
}

export function diffSections(baseSections, amendments) {
  const base = new Map(baseSections.map((s) => [s.ref, s]));
  const diff = { added: [], modified: [], repealed: [], unchanged: [] };
  for (const a of amendments) {
    const old = base.get(a.ref);
    if (REPEALED.test(a.body)) {
      if (old) diff.repealed.push({ ref: a.ref, heading: old.heading, oldBody: old.body });
    } else if (!old) diff.added.push({ ref: a.ref, heading: a.heading, newBody: a.body });
    else if (old.body.trim() !== a.body.trim() || old.heading !== a.heading) diff.modified.push({ ref: a.ref, heading: a.heading, oldBody: old.body, newBody: a.body });
    else diff.unchanged.push({ ref: a.ref });
  }
  return diff;
}

export function mergeSections(baseSections, amendments) {
  const out = baseSections.map((s) => ({ ...s }));
  for (const a of amendments) {
    const idx = out.findIndex((s) => s.ref === a.ref);
    if (REPEALED.test(a.body)) { if (idx !== -1) out.splice(idx, 1); continue; }
    if (idx === -1) out.push({ ref: a.ref, heading: a.heading, body: a.body });
    else out[idx] = { ref: a.ref, heading: a.heading, body: a.body };
  }
  return out;
}

export function suggestRequirementsFrom(reqs, sourceId, diff) {
  const touchedRefs = new Set([...diff.modified, ...diff.repealed, ...diff.added].map((d) => d.ref));
  const suggestions = new Map();
  for (const r of reqs) {
    if (r.sourceRefs.some((sr) => sr.source_id === sourceId && touchedRefs.has(sr.ref))) suggestions.set(r.code, 'mapped section changed');
  }
  for (const a of [...diff.added, ...diff.modified]) {
    const terms = new Set(tokenize(`${a.heading} ${a.newBody}`));
    for (const r of reqs) {
      if (suggestions.has(r.code)) continue;
      const rTerms = [...new Set(tokenize(`${r.title} ${r.obligation}`))];
      const overlap = rTerms.filter((t) => terms.has(t)).length;
      if (overlap >= 2) suggestions.set(r.code, `keyword overlap (${overlap}) with "${a.heading}"`);
    }
  }
  return [...suggestions].map(([code, reason]) => ({ code, reason }));
}
