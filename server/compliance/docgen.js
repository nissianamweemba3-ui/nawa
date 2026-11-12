// Starter document generator — the MVP generator, extended with organisation context, open gaps and
// references to the approved knowledge-base sources. Output is a starter draft that requires legal review.
import { badRequest } from '../lib/http.js';

export const DOC_TYPES = {
  'Data Protection Policy': { controls: ['ropa', 'basis', 'rights', 'security', 'retention', 'processors', 'breach', 'training'],
    extra: '\nCORE CONTROLS\n1. Data inventory and ROPA\n2. Lawful basis assessment\n3. Data subject rights handling\n4. Security controls\n5. Retention and disposal\n6. Processor management\n7. Incident/breach response\n8. Training and awareness\n9. Periodic compliance review\n' },
  'Privacy Notice': { controls: ['privacy', 'transfer', 'rights'],
    extra: '\nNOTICE CONTENT\nExplain identity/contact details; categories of data; purposes; lawful basis; recipients/processors; transfers; retention; data subject rights; complaints/contact route (including the Data Protection Commission); and material changes.\n' },
  'Data Breach Response Procedure': { controls: ['breach'],
    extra: '\nINCIDENT STEPS\n1. Detect and record\n2. Contain\n3. Assess affected data and people\n4. Preserve evidence\n5. Escalate to responsible personnel\n6. Assess notification obligations (Data Protection Commission and affected data subjects)\n7. Communicate where required\n8. Remediate\n9. Record lessons learned\n' },
  'Data Retention & Disposal Policy': { controls: ['retention'],
    extra: '\nRETENTION RULES\nCreate a schedule by processing purpose and applicable legal/business requirements. At expiry, securely delete, anonymise or otherwise dispose of data in accordance with the approved schedule.\n' },
  'Data Subject Rights Procedure': { controls: ['rights'],
    extra: '\nREQUEST WORKFLOW\nReceive and log request; verify identity where appropriate; identify systems and processors; assess the request; prepare response; record outcome and escalation.\n' },
  'Data Processing Agreement — starter': { controls: ['processors', 'transfer'],
    extra: '\nPROCESSOR TERMS\nDefine processing instructions, confidentiality, security, sub-processing, assistance with data subject rights, breach handling, return/deletion, audit/cooperation and cross-border arrangements. Obtain legal review before signature.\n' },
};

export function generateDocument({ type, dpo, org, latest, controls, index }) {
  const spec = DOC_TYPES[type];
  if (!spec) throw badRequest('Unknown document type');
  const responsible = dpo || 'Data Protection Officer / responsible person';
  const relevant = controls.filter((c) => spec.controls.includes(c.id));
  const openGaps = latest ? latest.gaps.filter((g) => spec.controls.includes(g.controlId)) : [];
  const sources = index.chunksForRefs(relevant.flatMap((c) => c.sourceRefs))
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

  let text = `${type.toUpperCase()}\n\nOrganisation: ${org.name}\nSector: ${org.sector}\nRole: ${org.role}\nResponsible person: ${responsible}\n` +
    `Generated: ${new Date().toISOString().slice(0, 10)} (starter draft)\n\n` +
    "PURPOSE\nThis document is a compliance aid for managing personal data responsibly under Zambia's data protection framework.\n\n" +
    'SCOPE\nApplies to relevant employees, contractors, systems and third parties processing personal data for or on behalf of the organisation.\n\n' +
    'GOVERNANCE\nThe organisation should maintain appropriate records, assign responsibility, review controls periodically and retain evidence of compliance.\n' +
    spec.extra;
  if (openGaps.length) {
    text += `\nOPEN GAPS TO ADDRESS (from latest assessment, score ${latest.score}%)\n` +
      openGaps.map((g, i) => `${i + 1}. [${g.priority}] ${g.question} — current answer: ${g.answer}`).join('\n') + '\n';
  }
  if (sources.length) {
    text += '\nAPPROVED SOURCE REFERENCES\n' + sources.map((s) => `- ${s.sourceTitle} — ${s.ref}${s.referenceVerified ? '' : ' (pilot summary; verify reference)'}`).join('\n') + '\n';
  }
  text += '\nLEGAL REVIEW\nThis starter document must be reviewed against the current Data Protection Act, regulations, DPC guidance and the ' +
    "organisation's actual processing activities before adoption. It is not legal advice and does not certify compliance.\n";
  return { type, text, sources: sources.map((s) => ({ id: s.id, ref: s.ref, sourceTitle: s.sourceTitle })) };
}
