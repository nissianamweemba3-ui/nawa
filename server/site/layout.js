// HTML document shell for public pages: metadata, social cards, structured data, header, breadcrumbs, footer.
import { SITE_NAME, absolute, jsonLd, jsonLdScript } from './seo.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const OG_IMAGE = { path: '/assets/og-image.png', width: 1200, height: 630,
  alt: 'DPA Zambia Compliance Platform: data protection compliance for organisations in Zambia' };

function header() {
  return `<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/"><img src="/assets/logo.svg" width="32" height="32" alt=""><span>DPA Zambia</span></a>
    <nav aria-label="Main">
      <ul class="nav-list">
        <li><a href="/#features">Features</a></li>
        <li><a href="/#security">Security</a></li>
        <li><a class="btn btn-light" href="/app">Sign in</a></li>
      </ul>
    </nav>
  </div>
</header>`;
}

function breadcrumbNav(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map((b, i) => (i === items.length - 1
    ? `<li><span aria-current="page">${esc(b.name)}</span></li>`
    : `<li><a href="${esc(b.path)}">${esc(b.name)}</a></li>`)).join('')}</ol></nav>`;
}

function footer(config) {
  const operator = config.operatorName
    ? `<p>Operated by ${esc(config.operatorName)}.${config.contactEmail ? ` Contact: <a href="mailto:${esc(config.contactEmail)}">${esc(config.contactEmail)}</a>` : ''}</p>`
    : '';
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-brand"><img src="/assets/logo.svg" width="24" height="24" alt=""> DPA Zambia Compliance Platform</p>
      <p class="muted">A tool for assessing and evidencing compliance with the Data Protection Act No. 3 of 2021. It is not legal advice and does not submit anything to the Data Protection Commission.</p>${operator ? `\n      ${operator}` : ''}
    </div>
    <nav aria-label="Footer">
      <ul class="footer-links">
        <li><a href="/app">Sign in</a></li>
        <li><a href="/app#register">Create an organisation account</a></li>
        <li><a href="/privacy">Privacy policy</a></li>
        <li><a href="/terms">Terms of use</a></li>
      </ul>
    </nav>
  </div>
</footer>`;
}

// page: { path, title, description, body, indexable, breadcrumbs, isHome }
export function renderPage({ base, config, page }) {
  const url = absolute(base, page.path);
  const fullTitle = page.isHome ? page.title : `${page.title} | DPA Zambia`;
  const image = absolute(base, OG_IMAGE.path);
  const meta = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="robots" content="${page.indexable ? 'index, follow' : 'noindex, follow'}">`,
    page.indexable ? `<link rel="canonical" href="${esc(url)}">` : '',
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    '<meta name="theme-color" content="#172554">',
  ];
  if (page.indexable) {
    meta.push(
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
      `<meta property="og:title" content="${esc(fullTitle)}">`,
      `<meta property="og:description" content="${esc(page.description)}">`,
      `<meta property="og:url" content="${esc(url)}">`,
      `<meta property="og:image" content="${esc(image)}">`,
      `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
      `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
      `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(fullTitle)}">`,
      `<meta name="twitter:description" content="${esc(page.description)}">`,
      `<meta name="twitter:image" content="${esc(image)}">`,
      `<meta name="twitter:image:alt" content="${esc(OG_IMAGE.alt)}">`,
      `<script type="application/ld+json">${jsonLdScript(jsonLd({ base, config, path: page.path, title: fullTitle,
        description: page.description, breadcrumbs: page.breadcrumbs ?? null, isHome: Boolean(page.isHome) }))}</script>`,
    );
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${meta.filter(Boolean).join('\n')}
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/site.css">
</head>
<body>
${header()}
<main id="main">
${page.breadcrumbs ? `<div class="wrap">${breadcrumbNav(page.breadcrumbs)}</div>` : ''}
${page.body}
</main>
${footer(config)}
</body>
</html>
`;
}
