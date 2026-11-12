// AI Compliance Assistant: answers questions using approved legal sources + authorised organisation context.
// RAG flow: verify permissions (gateway) → retrieve approved, version-controlled sources → assemble only the
// session organisation's minimised context → generate grounded answer → verify citations → log.
import { TenantRepo } from '../tenancy.js';
import { listControls } from '../kb/store.js';
import { minimisedOrgContext } from '../compliance/state.js';
import { validateGroundedAnswer } from './guards.js';
import { BASE_SYSTEM_PROMPT } from './gateway.js';
import { badRequest } from '../lib/http.js';

import { INSUFFICIENT_MESSAGE, GROUNDED_SCHEMA, sourceBlock, describeChunk, composeAnswer } from './assistant-core.js';

export { INSUFFICIENT_MESSAGE, GROUNDED_SCHEMA, describeChunk } from './assistant-core.js';

export class ComplianceAssistant {
  constructor({ db, index, gateway }) {
    this.db = db;
    this.index = index;
    this.gateway = gateway;
  }

  retrieve(question, control) {
    const hits = this.index.search(question, { k: 5 });
    if (control) {
      for (const c of this.index.chunksForRefs(control.sourceRefs)) if (!hits.some((h) => h.id === c.id)) hits.push(c);
    }
    return hits.slice(0, 7);
  }

  async ask(ctx, { question, controlId = null }) {
    if (typeof question !== 'string' || !question.trim()) throw badRequest("'question' is required");
    const controls = listControls(this.db);
    const control = controlId ? controls.find((c) => c.id === controlId) : null;
    if (controlId && !control) throw badRequest('Unknown controlId');

    const chunks = this.retrieve(question, control);
    const repo = new TenantRepo(this.db, ctx.orgId);
    const orgContext = minimisedOrgContext(repo, controls);
    const controlInfo = control ? {
      id: control.id, question: control.question, priority: control.priority, plainLanguage: control.plainLanguage,
      evidenceExpectations: control.evidence, currentAnswer: orgContext.deterministicAssessment?.gaps.find((g) => g.controlId === control.id)?.answer
        ?? (orgContext.deterministicAssessment ? 'yes' : 'not assessed'),
      evidenceStatus: orgContext.evidenceStatus[control.id],
    } : null;

    const outcome = await this.gateway.run(ctx, {
      kind: 'assistant',
      input: question,
      retrievedIds: chunks.map((c) => c.id),
      schema: GROUNDED_SCHEMA,
      // With no approved source retrieved there is nothing to ground on: answer safely without calling a model.
      skipModel: chunks.length === 0,
      buildPrompt: (q) => ({
        system: BASE_SYSTEM_PROMPT,
        user: [
          'APPROVED SOURCES (the only basis for legal statements):',
          sourceBlock(chunks),
          '',
          'AUTHORISED ORGANISATION CONTEXT (this organisation only; minimised; deterministic score is authoritative):',
          JSON.stringify(orgContext),
          controlInfo ? `\nCONTROL IN FOCUS:\n${JSON.stringify(controlInfo)}` : '',
          '',
          `USER QUESTION:\n${q}`,
        ].join('\n'),
      }),
      offline: () => this.compose(chunks, controlInfo, orgContext),
      validate: (raw) => validateGroundedAnswer(raw, chunks, { insufficientMessage: INSUFFICIENT_MESSAGE }),
    });

    const cited = new Set(outcome.result.citations ?? []);
    return {
      ...outcome,
      sources: chunks.filter((c) => cited.has(c.id)).map(describeChunk),
      retrieved: chunks.map((c) => ({ id: c.id, heading: c.heading, ref: c.ref, score: c.score ?? null })),
    };
  }

  compose(chunks, controlInfo, orgContext) { return composeAnswer(chunks, controlInfo, orgContext); }
}
