// AI security controls: prompt-injection detection, data minimisation (PII redaction), untrusted-content
// isolation, and output validation (citation verification, over-claim removal, grounding signals).
import { tokenize } from '../kb/retrieval.js';

const INJECTION_PATTERNS = [
  { id: 'override_instructions', severity: 'high', re: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|any|system|your)\b[^.\n]{0,20}\b(instructions?|prompts?|rules?|directions?|guidelines?|polic(y|ies))\b/i },
  { id: 'reveal_system_prompt', severity: 'high', re: /\b(reveal|print|show|output|repeat|display|leak|dump)\b[^.\n]{0,40}\b(system prompt|system message|hidden instructions?|developer (message|prompt)|initial instructions?)\b/i },
  { id: 'persona_jailbreak', severity: 'high', re: /\b(you are now|from now on you are|act as|pretend to be|behave as)\b[^.\n]{0,30}\b(dan|developer mode|jailbr[eo]ak\w*|unrestricted|unfiltered|no (rules|restrictions|limits))\b/i },
  { id: 'cross_tenant_request', severity: 'high', re: /\b(other|another|different|all|every)\s+(organi[sz]ations?|tenants?|clients?|customers?|compan(y|ies))('s|s'|s)?\b[^.\n]{0,30}\b(data|records?|evidence|information|files?|documents?|assessments?|scores?)\b/i },
  { id: 'bypass_controls', severity: 'high', re: /\b(bypass|circumvent|disable|turn off|get around)\b[^.\n]{0,30}\b(security|permissions?|access controls?|tenant|isolation|filters?|guardrails?|safety)\b/i },
  { id: 'role_tag_spoof', severity: 'medium', re: /(<\/?\s*(system|assistant|instructions?|untrusted_document)\s*>|\[\/?INST\]|^\s*(system|assistant)\s*:)/im },
  { id: 'force_compliant_outcome', severity: 'medium', re: /\b(mark|set|report|treat|record|classify)\b[^.\n]{0,30}\b(as|to be)\s+(fully\s+)?(compliant|complete|passed|approved|no (gaps|findings|issues))\b/i },
  { id: 'suppress_findings', severity: 'medium', re: /\b(do not|don't|never)\s+(mention|report|flag|include|list|disclose)\b[^.\n]{0,40}\b(gaps?|findings?|issues?|risks?|this|missing)\b/i },
  { id: 'new_instructions', severity: 'medium', re: /\b(new|updated|additional)\s+instructions?\s*:/i },
  { id: 'ai_addressed', severity: 'low', re: /\b(dear|attention|note to|hey)\s+(ai|assistant|chatbot|llm|model|claude|gpt)\b/i },
];

export function scanForInjection(text) {
  const s = String(text ?? '');
  const hits = [];
  for (const p of INJECTION_PATTERNS) {
    const m = p.re.exec(s);
    if (m) hits.push({ id: p.id, severity: p.severity, excerpt: m[0].slice(0, 120) });
  }
  const order = { none: 0, low: 1, medium: 2, high: 3 };
  const severity = hits.reduce((acc, h) => (order[h.severity] > order[acc] ? h.severity : acc), 'none');
  return { severity, hits };
}

const REDACTIONS = [
  { label: '[EMAIL]', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: '[NRC]', re: /\b\d{6}\/\d{2}\/\d\b/g },                          // Zambian National Registration Card format
  { label: '[CARD_OR_ACCOUNT]', re: /\b(?:\d[ -]?){12,18}\d\b/g },
  { label: '[PHONE]', re: /(?:\+260|\b260|\b0)[\s-]?[79]\d(?:[\s-]?\d){7}\b/g },
];

// Data minimisation before any AI request: direct identifiers are replaced with typed placeholders.
export function redactPII(text) {
  let out = String(text ?? '');
  const counts = {};
  for (const r of REDACTIONS) {
    out = out.replace(r.re, () => { counts[r.label] = (counts[r.label] ?? 0) + 1; return r.label; });
  }
  return { text: out, redactions: counts };
}

// Untrusted content is fenced, its fence tokens neutralised, and labelled as data — never instructions.
export function wrapUntrusted(label, content) {
  const neutralised = String(content).replace(/<\s*\/?\s*untrusted_document[^>]*>/gi, '[removed-tag]');
  return `<untrusted_document label="${label.replace(/[^\w .-]/g, '')}">\n${neutralised}\n</untrusted_document>`;
}

const OVERCLAIM = [
  /\b(you|your organi[sz]ation|the organi[sz]ation|it|this organi[sz]ation)\s+(is|are)\s+(now\s+)?(fully\s+|100%\s+|officially\s+|legally\s+)?(compliant|certified)\b/i,
  /\b(i|we|this platform|the platform)\s+(hereby\s+)?(certif(y|ies)|guarantee[sd]?)\b/i,
  /\bguarantee[sd]?\s+(that\s+)?(you|your|full|legal|complete)\b[^.]*\bcompli/i,
  /\b(officially|legally)\s+(approved|certified)\b/i,
];

function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+/);
}

export function removeOverclaims(text) {
  let removed = 0;
  const kept = splitSentences(text).map((s) => {
    if (OVERCLAIM.some((re) => re.test(s))) { removed += 1; return '[Removed: this platform cannot certify or guarantee compliance.]'; }
    return s;
  });
  return { text: kept.join(' '), removed };
}

// Validates a grounded answer: every citation must reference a chunk that was actually retrieved and
// supplied to the model; inline markers must match; an answer without valid citations is downgraded.
export function validateGroundedAnswer(raw, allowedChunks, { insufficientMessage }) {
  const flags = [];
  const allowed = new Map(allowedChunks.map((c) => [c.id, c]));
  const result = {
    answer: typeof raw?.answer === 'string' ? raw.answer.trim() : '',
    citations: Array.isArray(raw?.citations) ? raw.citations.filter((c) => typeof c === 'string') : [],
    confidence: ['high', 'medium', 'low'].includes(raw?.confidence) ? raw.confidence : 'low',
    insufficientSources: raw?.insufficient_sources === true,
  };

  const valid = [...new Set(result.citations.filter((id) => allowed.has(id)))];
  const fabricated = result.citations.filter((id) => !allowed.has(id));
  if (fabricated.length) flags.push({ id: 'fabricated_citation_removed', detail: fabricated.slice(0, 10) });

  // Inline markers like [S-1a2b3c4d] that do not correspond to supplied chunks are stripped.
  result.answer = result.answer.replace(/\[(S-[0-9a-f-]{8,36})\]/gi, (m, id) => {
    if (allowed.has(id)) { if (!valid.includes(id)) valid.push(id); return m; }
    flags.push({ id: 'fabricated_inline_citation_removed', detail: id });
    return '';
  });

  const oc = removeOverclaims(result.answer);
  if (oc.removed) flags.push({ id: 'overclaim_removed', detail: oc.removed });
  result.answer = oc.text;

  if (!result.answer) {
    flags.push({ id: 'empty_answer' });
    result.insufficientSources = true;
  }
  if (!result.insufficientSources && valid.length === 0) {
    flags.push({ id: 'ungrounded_answer_downgraded' });
    result.insufficientSources = true;
  }
  if (result.insufficientSources) {
    result.answer = result.answer && valid.length ? result.answer : insufficientMessage;
    result.confidence = 'low';
  }

  // Lexical grounding signal: share of answer content terms present in the cited sources.
  if (valid.length) {
    const sourceTerms = new Set(valid.flatMap((id) => tokenize(`${allowed.get(id).heading} ${allowed.get(id).text}`)));
    const answerTerms = [...new Set(tokenize(result.answer))];
    const overlap = answerTerms.length ? answerTerms.filter((t) => sourceTerms.has(t)).length / answerTerms.length : 0;
    result.groundingOverlap = Number(overlap.toFixed(2));
    if (overlap < 0.25) flags.push({ id: 'weak_grounding', detail: result.groundingOverlap });
  }
  result.citations = valid;
  return { result, flags };
}

// Every number in a narrative must appear in the facts it was generated from (no invented statistics).
export function numbersSupported(narrative, facts) {
  const factNumbers = new Set((JSON.stringify(facts).match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  const used = (String(narrative).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const unsupported = used.filter((n) => !factNumbers.has(n));
  return { ok: unsupported.length === 0, unsupported };
}
