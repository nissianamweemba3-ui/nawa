// Assistant core (pure; shared with the browser demo): schema, prompt blocks and the deterministic composer.

export const INSUFFICIENT_MESSAGE =
  'I could not find approved, version-controlled sources in the platform knowledge base that answer this question, ' +
  'so I will not guess. Please consult the official text of the Data Protection Act No. 3 of 2021, guidance from the ' +
  'Data Protection Commission, or a qualified legal adviser.';

export const GROUNDED_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Plain-language answer. May include inline citation markers like [S-1a2b3c4d].' },
    citations: { type: 'array', items: { type: 'string' }, description: 'IDs of approved sources that support the answer.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    insufficient_sources: { type: 'boolean' },
  },
  required: ['answer', 'citations', 'confidence', 'insufficient_sources'],
  additionalProperties: false,
};

export const firstSentences = (text, n = 2) => text.split(/(?<=[.!?])\s+/).slice(0, n).join(' ');

export function sourceBlock(chunks) {
  return chunks.map((c) => [
    `<source id="${c.id}">`,
    `Title: ${c.sourceTitle} — ${c.versionLabel}`,
    `Reference: ${c.ref}${c.referenceVerified ? '' : ' (pilot summary; reference not yet verified)'}`,
    `Heading: ${c.heading}`,
    `Text: ${c.text}`,
    '</source>',
  ].join('\n')).join('\n');
}

export function describeChunk(c) {
  return {
    id: c.id, sourceTitle: c.sourceTitle, versionLabel: c.versionLabel, ref: c.ref, heading: c.heading, text: c.text,
    referenceVerified: c.referenceVerified, pilotBaseline: c.pilotBaseline,
  };
}

// Deterministic, extractive composer used when no model is configured or the provider fails.
export function composeAnswer(chunks, controlInfo, orgContext) {
  if (chunks.length === 0) return { answer: INSUFFICIENT_MESSAGE, citations: [], confidence: 'low', insufficient_sources: true };
  const top = chunks.slice(0, 3);
  const lines = ['Here is what the approved sources in the knowledge base say:'];
  for (const c of top) lines.push(`• ${c.heading} (${c.sourceTitle}, ${c.ref}): ${firstSentences(c.text)} [${c.id}]`);
  if (controlInfo) {
    lines.push('', `For your organisation: this control is ${controlInfo.priority} priority. Current assessment answer: ${controlInfo.currentAnswer}. ` +
      `Evidence status: ${controlInfo.evidenceStatus}. Evidence that may demonstrate it: ${controlInfo.evidenceExpectations.join('; ')}.`);
  } else if (orgContext.deterministicAssessment) {
    lines.push('', `Your latest deterministic compliance score is ${orgContext.deterministicAssessment.score}% (${orgContext.deterministicAssessment.risk} risk).`);
  }
  if (top.some((c) => !c.referenceVerified)) lines.push('', 'Note: these are pilot-baseline summaries; verify the references against the official text before relying on them.');
  lines.push('This is guidance, not legal advice or certification.');
  return { answer: lines.join('\n'), citations: top.map((c) => c.id), confidence: 'medium', insufficient_sources: false };
}
