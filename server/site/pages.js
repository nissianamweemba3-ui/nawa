// Public page content. Copy describes what this codebase actually does; deployment-specific facts
// (operator, contact, AI provider) come from configuration so the pages stay accurate per deployment.
import { esc } from './layout.js';

export const LEGAL_LAST_UPDATED = '16 November 2026';

export function homePage() {
  return {
    path: '/',
    isHome: true,
    indexable: true,
    title: 'Zambia Data Protection Act compliance | DPA Zambia',
    description: 'Assess your organisation against the Data Protection Act No. 3 of 2021, keep evidence and tasks in one place, and get answers that cite approved legal sources.',
    body: `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">For data controllers and processors in Zambia</p>
      <h1>Track your compliance with Zambia's Data Protection Act in one place</h1>
      <p class="lead">Answer a structured assessment, see a transparent compliance score, attach the evidence that supports each answer, and work through a prioritised remediation plan.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/app#register">Create an organisation account</a>
        <a class="btn btn-secondary" href="/app">Sign in</a>
      </div>
    </div>
    <figure class="hero-figure">
      <picture>
        <source type="image/webp" srcset="/assets/dashboard-640.webp 640w, /assets/dashboard-1280.webp 1280w" sizes="(max-width: 900px) 100vw, 600px">
        <img src="/assets/dashboard-1280.jpg" srcset="/assets/dashboard-640.jpg 640w, /assets/dashboard-1280.jpg 1280w" sizes="(max-width: 900px) 100vw, 600px"
          width="1280" height="800" fetchpriority="high"
          alt="Compliance dashboard showing a score of 63 percent, medium risk, eight open gaps and a ranked list of priorities">
      </picture>
      <figcaption>The compliance dashboard, shown with demonstration data.</figcaption>
    </figure>
  </div>
</section>

<section id="features" class="section">
  <div class="wrap">
    <h2>What the platform does</h2>
    <div class="feature-grid">
      <article class="feature">
        <h3>Assessment with a transparent score</h3>
        <p>Fifteen questions, each mapped to a requirement of the Act such as registration with the Data Protection Commission, breach notification and cross-border transfers. The score is a weighted calculation you can inspect, and it is never changed by AI.</p>
      </article>
      <article class="feature">
        <h3>Evidence and remediation</h3>
        <p>Attach registration certificates, policies and training records to the control they support. The platform flags evidence that is missing, expiring or past its review date, and turns gaps into tasks with priorities and due dates.</p>
      </article>
      <article class="feature">
        <h3>Answers that cite their sources</h3>
        <p>The compliance assistant answers from a reviewed library of legal sources and shows the passage behind each statement. When the library does not cover a question, it says so instead of guessing.</p>
      </article>
      <article class="feature">
        <h3>Policy and document review</h3>
        <p>Check a privacy notice, breach procedure, retention policy or processing agreement against a checklist. Each potential gap is reviewed by a person before it becomes a task.</p>
      </article>
      <article class="feature">
        <h3>Regulatory updates you can act on</h3>
        <p>Changes to the Act, regulations or Commission guidance are compared with the current text and approved by a legal reviewer before they reach you, with the affected controls listed.</p>
      </article>
      <article class="feature">
        <h3>Reports for management</h3>
        <p>A management summary and score trend built from your own assessment, evidence and task data, with every figure traceable to the platform.</p>
      </article>
    </div>
  </div>
</section>

<section id="security" class="section section-alt">
  <div class="wrap two-col">
    <div>
      <h2>How your organisation's data is protected</h2>
      <p>Compliance records are sensitive. These controls are built into the platform.</p>
    </div>
    <ul class="check-list">
      <li><strong>Separate workspaces.</strong> Each organisation sees only its own assessments, evidence and tasks. This is enforced on every request and covered by automated tests.</li>
      <li><strong>Encrypted evidence.</strong> Uploaded files are encrypted at rest with AES-256-GCM.</li>
      <li><strong>Two-factor sign-in.</strong> Users can protect their accounts with an authenticator app.</li>
      <li><strong>Roles.</strong> Owners, administrators, compliance officers, contributors and viewers each have defined permissions.</li>
      <li><strong>Tamper-evident audit log.</strong> Every significant action is recorded in a hash-chained log you can verify.</li>
      <li><strong>Careful AI use.</strong> Email addresses and identity, phone and card numbers are removed before any text reaches an AI model. Assistant questions are answered from a minimised summary of your compliance position, not your organisation's name or files.</li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>What the platform does not do</h2>
    <div class="limits">
      <p>It does not register you with the Data Protection Commission or submit anything on your behalf.</p>
      <p>It does not provide legal advice or certify that an organisation is compliant.</p>
      <p>The legal library currently contains plain-language summaries that are labelled as awaiting verification against the official text by a qualified legal reviewer.</p>
    </div>
  </div>
</section>

<section class="section cta-band">
  <div class="wrap cta-inner">
    <h2>Start your first assessment</h2>
    <p>Create an account for your organisation, answer the fifteen questions and get your score and action plan.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/app#register">Create an organisation account</a>
      <a class="btn btn-secondary" href="/app">Sign in</a>
    </div>
  </div>
</section>`,
  };
}

function operatorBlock(config) {
  if (config.operatorName) {
    return `<p>This deployment of the platform is operated by <strong>${esc(config.operatorName)}</strong>, which is responsible for the personal data processed in it.${
      config.contactEmail ? ` You can contact the operator at <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>.` : ''}</p>`;
  }
  return '<p class="notice">This is a development deployment and its operator has not been configured. Production deployments must set the operator name and contact email before they will start.</p>';
}

function hostingBlock(config) {
  if (!config.hostingLocation) {
    return '<p class="notice">The hosting location of this development deployment has not been configured. Production deployments must state it before they will start.</p>';
  }
  const inZambia = /zambia/i.test(config.hostingLocation);
  return `<p>The platform's server, database and evidence files are hosted in ${esc(config.hostingLocation)}.${inZambia ? '' :
    ' This means personal data is stored outside Zambia. The Act restricts transfers of personal data outside Zambia, and the operator is responsible for ensuring this hosting arrangement meets those conditions.'}</p>`;
}

const contactLine = (config) => (config.contactEmail
  ? `<a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>`
  : 'the operator');

export function privacyPage(config) {
  const aiLive = config.ai.provider === 'anthropic';
  return {
    path: '/privacy',
    indexable: true,
    title: 'Privacy policy',
    description: 'How the DPA Zambia Compliance Platform collects, uses, protects and shares personal data, including account data, evidence files, audit logs and AI features.',
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Privacy policy', path: '/privacy' }],
    body: `
<article class="wrap prose">
  <h1>Privacy policy</h1>
  <p class="muted">Last updated: ${LEGAL_LAST_UPDATED}</p>

  <h2>Who is responsible</h2>
  ${operatorBlock(config)}

  <h2>What this policy covers</h2>
  <p>This policy describes the personal data processed when you use the public website and the signed-in compliance application. Organisations that use the application decide what information they upload about their own processing activities, staff or customers, and are responsible for that information.</p>

  <h2>Personal data we process</h2>
  <h3>Account information</h3>
  <p>Your name, email address and a one-way hash of your password (scrypt). We never store your password itself. If you turn on two-factor sign-in, the authenticator secret is stored encrypted.</p>
  <h3>Sessions</h3>
  <p>When you sign in, the platform sets one cookie, <code>zcip_sid</code>, that keeps you signed in. It is HttpOnly, limited to this site and expires after 8 hours by default. Only a hash of its value is stored on the server. The platform uses no analytics, advertising or third-party cookies.</p>
  <h3>Organisation and compliance records</h3>
  <p>Your organisation's profile, assessment answers and scores, tasks, document review results and regulatory notifications, together with which user created or changed them.</p>
  <h3>Evidence files</h3>
  <p>Files your organisation uploads, such as policies, registers and certificates. File contents are encrypted at rest with AES-256-GCM. The title, file name, size and a checksum are stored alongside them so the file can be identified and verified.</p>
  <h3>Audit log</h3>
  <p>A record of significant actions, such as sign-ins, failed sign-in attempts (including the email address that was tried), uploads and changes, with the time and the user involved. The log is hash-chained so that alterations can be detected.</p>
  <h3>Network information</h3>
  <p>Your IP address is used in memory to limit repeated sign-in and registration attempts. It is not written to the database.</p>

  <h2>Why we use it</h2>
  <ul>
    <li>To provide the application: sign-in, your organisation's workspace and its compliance features.</li>
    <li>To keep the service secure: preventing unauthorised access, limiting abuse and keeping an audit trail.</li>
    <li>To let your organisation demonstrate its compliance work to its own management and auditors.</li>
  </ul>

  <h2>AI features</h2>
  ${aiLive
    ? `<p>This deployment uses Claude, a model provided by Anthropic, to generate assistant answers, document review notes and management summaries. Before a request is sent, email addresses, Zambian National Registration Card numbers, phone numbers and card or account numbers are removed. The request contains your question, excerpts from the approved legal library and a minimised summary of your organisation's compliance position (sector, size band, controller or processor role, score, open gaps and evidence status). It does not contain your organisation's name, user names or email addresses. For document review, the document's text, with the identifiers above removed, is sent for analysis. Anthropic processes this data outside Zambia. The operator is responsible for assessing that transfer under the Act.</p>`
    : '<p>This deployment does not send any data to an external AI model provider. Assistant answers, document reviews and summaries are produced on the platform\'s own server by quoting the approved legal library and applying fixed rules.</p>'}
  <p>Every AI request is logged with the identifiers above removed, so that its use can be reviewed.</p>

  <h2>Who can see your data</h2>
  <ul>
    <li>Members of your organisation, according to the role your organisation gives them.</li>
    <li>Platform staff who maintain the legal library and review regulatory updates. Their roles do not give them access to any organisation's records through the application.</li>
    <li>The operator's technical administrators, who can access the server and database to run and secure the service.</li>
  </ul>
  <p>Personal data is not sold or used for advertising.</p>

  <h2>Where data is stored</h2>
  ${hostingBlock(config)}

  <h2>How long data is kept</h2>
  <p>Records are kept while your organisation's account is active. The platform does not delete records automatically. To have an account or organisation's records deleted, contact ${contactLine(config)}.</p>

  <h2>Your rights</h2>
  <p>The Data Protection Act No. 3 of 2021 gives you rights over your personal data, which may include access, correction, deletion and objection to processing. To make a request, contact ${contactLine(config)}. You can also complain to the Data Protection Commission of Zambia.</p>

  <h2>Security</h2>
  <p>The platform uses encryption of evidence and authenticator secrets, hashed passwords and session tokens, role-based permissions, separation between organisations, rate limiting and a tamper-evident audit log. No system is completely secure, so please report any concern to ${contactLine(config)}.</p>

  <h2>Changes to this policy</h2>
  <p>When this policy changes, the date at the top of the page will be updated.</p>

  <p><a href="/terms">Read the terms of use</a></p>
</article>`,
  };
}

export function termsPage(config) {
  return {
    path: '/terms',
    indexable: true,
    title: 'Terms of use',
    description: 'Terms for using the DPA Zambia Compliance Platform: what the service provides and does not, account responsibilities, acceptable use and limits of its legal content.',
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Terms of use', path: '/terms' }],
    body: `
<article class="wrap prose">
  <h1>Terms of use</h1>
  <p class="muted">Last updated: ${LEGAL_LAST_UPDATED}</p>

  <h2>Who provides the service</h2>
  ${operatorBlock(config)}

  <h2>The service</h2>
  <p>The platform helps organisations assess, evidence and manage their compliance with the Data Protection Act No. 3 of 2021 of Zambia. It provides a structured assessment and score, evidence storage, remediation tasks, a compliance assistant, document review against checklists, regulatory update notifications and management summaries.</p>

  <h2>What the service is not</h2>
  <ul>
    <li>It is not legal advice and is not a substitute for advice from a qualified legal practitioner.</li>
    <li>It does not register your organisation with the Data Protection Commission or submit anything on your behalf.</li>
    <li>A score, summary or document review is not a certification or guarantee of compliance.</li>
    <li>The legal library contains plain-language summaries. Entries marked as pilot summaries have not yet been verified against the official text and must be checked before you rely on them.</li>
    <li>Assistant answers and document review notes can be incomplete or wrong. Review them before acting.</li>
  </ul>

  <h2>Accounts</h2>
  <ul>
    <li>Give accurate information when you register, and keep your password and authenticator device secure.</li>
    <li>The person who creates an organisation becomes its owner and decides who else may join and in which role.</li>
    <li>You are responsible for activity under your account. Tell ${contactLine(config)} promptly if you believe your account has been misused.</li>
  </ul>

  <h2>Acceptable use</h2>
  <p>You must not:</p>
  <ul>
    <li>Upload information that your organisation is not entitled to process, or that you are not authorised to share with the platform.</li>
    <li>Attempt to access another organisation's records, or to bypass sign-in, permissions or rate limits.</li>
    <li>Attempt to make the compliance assistant reveal its instructions or other organisations' information.</li>
    <li>Upload malicious files or interfere with the operation or security of the service.</li>
  </ul>

  <h2>Your organisation's data</h2>
  <p>Your organisation keeps responsibility for the information it uploads. The <a href="/privacy">privacy policy</a> explains how personal data is processed, including when AI features are used.</p>

  <h2>Changes to the service and these terms</h2>
  <p>Features may change as the platform develops. When these terms change, the date at the top of the page will be updated.</p>

  <h2>Contact</h2>
  <p>Questions about these terms can be sent to ${contactLine(config)}.</p>
</article>`,
  };
}

export function notFoundPage() {
  return {
    path: '/404',
    indexable: false,
    title: 'Page not found',
    description: 'The page you requested does not exist on the DPA Zambia Compliance Platform.',
    body: `
<section class="wrap not-found">
  <p class="eyebrow">Error 404</p>
  <h1>Page not found</h1>
  <p>The address may be mistyped, or the page may have moved.</p>
  <ul class="link-list">
    <li><a href="/">Go to the home page</a></li>
    <li><a href="/app">Sign in to the application</a></li>
    <li><a href="/privacy">Privacy policy</a></li>
    <li><a href="/terms">Terms of use</a></li>
  </ul>
</section>`,
  };
}

export function badRequestPage() {
  return { ...notFoundPage(), title: 'Bad request',
    body: `
<section class="wrap not-found">
  <p class="eyebrow">Error 400</p>
  <h1>That address could not be read</h1>
  <p>The link contains characters that are not valid in a web address.</p>
  <ul class="link-list"><li><a href="/">Go to the home page</a></li></ul>
</section>` };
}
