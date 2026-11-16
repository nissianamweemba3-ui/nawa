// Technical SEO helpers: page registry, canonical URLs, robots.txt, sitemap.xml and JSON-LD.

export const SITE_NAME = 'DPA Zambia Compliance Platform';

// Indexable public pages. The sitemap is generated from this list, so it cannot drift from the routes.
export const INDEXABLE = [
  { path: '/', changefreq: 'monthly', priority: '1.0' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.4' },
  { path: '/terms', changefreq: 'yearly', priority: '0.4' },
];

// Base URL for absolute links. Production always uses SITE_URL (enforced at startup). Without it, a
// development server falls back to the request host, restricted to safe characters.
export function baseUrl(config, req) {
  if (config.siteUrl) return config.siteUrl;
  const host = String(req.headers.host ?? 'localhost').toLowerCase();
  return `http://${/^[a-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : 'localhost'}`;
}

export const absolute = (base, path) => (path === '/' ? `${base}/` : `${base}${path}`);

export function robotsTxt(base) {
  return [
    '# Public pages may be crawled. The signed-in application and the API are not public content.',
    'User-agent: *',
    'Allow: /',
    'Disallow: /app',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
}

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function sitemapXml(base) {
  const urls = INDEXABLE.map((p) => `  <url>\n    <loc>${xmlEscape(absolute(base, p.path))}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// JSON-LD graph for a page. Only facts the platform can state truthfully: no ratings, reviews, prices or
// invented business details. The publisher Organization is included only when OPERATOR_NAME is configured.
export function jsonLd({ base, config, path, title, description, breadcrumbs = null, isHome = false }) {
  const url = absolute(base, path);
  const websiteId = `${base}/#website`;
  const orgId = `${base}/#operator`;
  const appId = `${base}/#application`;
  const graph = [];
  if (config.operatorName) {
    graph.push({ '@type': 'Organization', '@id': orgId, name: config.operatorName, url: `${base}/`,
      ...(config.contactEmail ? { email: config.contactEmail } : {}), logo: `${base}/assets/logo-512.png` });
  }
  graph.push({ '@type': 'WebSite', '@id': websiteId, url: `${base}/`, name: SITE_NAME, inLanguage: 'en',
    ...(config.operatorName ? { publisher: { '@id': orgId } } : {}) });
  const page = { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: 'en', isPartOf: { '@id': websiteId } };
  if (breadcrumbs) page.breadcrumb = { '@id': `${url}#breadcrumb` };
  if (isHome) page.about = { '@id': appId };
  graph.push(page);
  if (isHome) {
    graph.push({ '@type': 'SoftwareApplication', '@id': appId, name: SITE_NAME, url: `${base}/app`, applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web browser', description: 'Web application for assessing and evidencing compliance with the Data Protection Act No. 3 of 2021 of Zambia.',
      ...(config.operatorName ? { provider: { '@id': orgId } } : {}) });
  }
  if (breadcrumbs) {
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem', position: i + 1, name: b.name, item: absolute(base, b.path) })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// Serialises JSON-LD for safe embedding inside a <script> element.
export const jsonLdScript = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
