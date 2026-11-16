// Legal RAG retrieval: BM25 over sections of APPROVED, CURRENT knowledge-base versions only.
// Draft, pending, rejected and superseded versions are never indexed (retrieval-poisoning defence).
// Deterministic and explainable; an embedding index can be added behind the same interface later.

const STOPWORDS = new Set(`a an and are as at be been being but by can could do does did for from had has have how i if in into is it its
of on or our should so such than that the their them then there these they this to us was we were what when where which who why will
with would you your yours my me mine about any all also may must need needs shall not no yes per via within without under over between
zambia zambian act law laws legal regulation regulations section sections requirement requirements mean means meaning tell explain
please organisation organization company business data personal management manage managing handle handling ask asking include
includes expect expected information info get got make sure regard regarding relation related like want keep
non compliance compliant comply complying`.split(/\s+/).filter(Boolean));

// Light, deterministic suffix stemmer. Applied identically to documents and queries.
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1); // store/stored → stor, measure/measures → measur
  return w;
}

export function tokenize(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem);
}

// Domain vocabulary: everyday words → the terms the legal sources use. Query-side only, so it widens
// recall without changing what the sources say. Coverage is measured per query concept, not per word.
const EXPANSIONS = {
  dpo: 'data protection officer', officer: 'officer',
  dpia: 'impact assessment', ropa: 'record processing activities', dpc: 'commission',
  cloud: 'transfer outside stored', abroad: 'transfer outside', overseas: 'transfer outside', foreign: 'transfer outside',
  international: 'transfer outside', offshore: 'transfer outside', country: 'transfer outside', countries: 'transfer outside',
  south: 'transfer outside', africa: 'transfer outside', europe: 'transfer outside', america: 'transfer outside', usa: 'transfer outside',
  uk: 'transfer outside', china: 'transfer outside', india: 'transfer outside', kenya: 'transfer outside',
  delete: 'erasure', deletion: 'erasure', erase: 'erasure', remove: 'erasure', forgotten: 'erasure',
  retain: 'retention kept', long: 'retention kept', archive: 'retention', destroy: 'disposal retention',
  health: 'sensitive health', medical: 'sensitive health', patient: 'sensitive health subjects', patients: 'sensitive health subjects',
  biometric: 'sensitive biometrics', fingerprint: 'sensitive biometrics', religion: 'sensitive religious', ethnic: 'sensitive ethnic',
  vendor: 'processor contract', vendors: 'processor contract', supplier: 'processor contract', suppliers: 'processor contract',
  contractor: 'processor contract', outsource: 'processor contract', outsourcing: 'processor contract',
  marketing: 'consent', newsletter: 'consent', sms: 'consent', cookie: 'consent', cookies: 'consent',
  fine: 'penalties offences enforcement', fines: 'penalties offences enforcement', penalty: 'penalties offences', sanction: 'enforcement',
  hack: 'breach', hacked: 'breach', leak: 'breach', leaked: 'breach', lost: 'breach loss', stolen: 'breach', incident: 'breach incidents', cyberattack: 'breach',
  notify: 'notification notified', report: 'notification notified', reporting: 'notification notified',
  customer: 'subjects', customers: 'subjects', client: 'subjects', clients: 'subjects', employee: 'subjects', employees: 'subjects',
  individual: 'subjects', individuals: 'subjects', people: 'subjects', person: 'subjects', user: 'subjects', users: 'subjects',
  policy: 'notice policy', register: 'registration register', encrypt: 'encryption security', password: 'access security', backup: 'backups security',
};
const EXPANSION_STEMS = new Map(Object.entries(EXPANSIONS).map(([k, v]) => [stem(k), [...new Set(tokenize(v))]]));

// Query concepts: each original term plus its domain expansions.
export function queryConcepts(query) {
  const terms = [...new Set(tokenize(query))];
  return terms.map((t) => ({ term: t, alts: [...new Set([t, ...(EXPANSION_STEMS.get(t) ?? [])])] }));
}

const K1 = 1.4;
const B = 0.75;

export class LegalIndex {
  constructor(db) { this.db = db; this.build(); }

  build() {
    const rows = this.db.prepare(`
      SELECT s.id, s.ref, s.heading, s.body, s.reference_verified, v.id AS version_id, v.version_label, v.pilot_baseline,
             v.reviewed_by, src.id AS source_id, src.title AS source_title
      FROM kb_sections s
      JOIN kb_versions v ON v.id = s.version_id
      JOIN kb_sources src ON src.id = v.source_id
      WHERE v.status = 'approved' AND v.is_current = 1`).all();
    this.docs = rows.map((r) => {
      const tokens = tokenize(`${r.heading} ${r.heading} ${r.body}`); // heading weighted x2
      const tf = new Map();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      return { chunk: toChunk(r), tf, len: tokens.length };
    });
    // Short chunk IDs are friendlier for citation; fall back to the full section UUID on any collision.
    const seen = new Map();
    for (const d of this.docs) seen.set(d.chunk.id, (seen.get(d.chunk.id) ?? 0) + 1);
    for (const d of this.docs) if (seen.get(d.chunk.id) > 1) d.chunk.id = `S-${d.chunk.sectionId}`;
    this.df = new Map();
    for (const d of this.docs) for (const t of d.tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length);
    this.byId = new Map(this.docs.map((d) => [d.chunk.id, d.chunk]));
  }

  idf(term) {
    const n = this.docs.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  // Returns chunks whose BM25 score passes minScore AND that match at least minCoverage of the query terms.
  search(query, { k = 5, minScore = 2.5, minCoverage = 0.34, relativeCutoff = 0.5 } = {}) {
    const concepts = queryConcepts(query);
    if (concepts.length === 0) return [];
    const scored = [];
    for (const d of this.docs) {
      let score = 0, matched = 0;
      for (const { alts } of concepts) {
        // Best-matching alternative per concept, so synonyms widen recall without inflating scores.
        let best = 0;
        for (const t of alts) {
          const f = d.tf.get(t);
          if (!f) continue;
          best = Math.max(best, this.idf(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / this.avgLen)))));
        }
        if (best > 0) { matched += 1; score += best; }
      }
      const coverage = matched / concepts.length;
      if (score >= minScore && coverage >= minCoverage) scored.push({ ...d.chunk, score: Number(score.toFixed(3)), coverage: Number(coverage.toFixed(2)) });
    }
    scored.sort((a, b) => b.score - a.score);
    // Relative cutoff: drop weak tail matches that score far below the best match.
    const top = scored[0]?.score ?? 0;
    return scored.filter((s) => s.score >= top * relativeCutoff).slice(0, k);
  }

  getChunk(id) { return this.byId.get(id) ?? null; }

  // Approved current chunks for given (source_id, ref) pairs — used to attach sources to controls.
  chunksForRefs(refs) {
    const out = [];
    for (const { source_id, ref } of refs) {
      const hit = this.docs.find((d) => d.chunk.sourceId === source_id && d.chunk.ref === ref);
      if (hit) out.push(hit.chunk);
    }
    return out;
  }
}

function toChunk(r) {
  return {
    id: `S-${r.id.slice(0, 8)}`,
    sectionId: r.id,
    sourceId: r.source_id,
    sourceTitle: r.source_title,
    versionId: r.version_id,
    versionLabel: r.version_label,
    ref: r.ref,
    heading: r.heading,
    text: r.body,
    referenceVerified: Boolean(r.reference_verified),
    pilotBaseline: Boolean(r.pilot_baseline),
  };
}
