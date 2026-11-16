// Public (non-API) routing: pages, the web client at /app, robots.txt, sitemap.xml, static assets and 404s.
import path from 'node:path';
import { SECURITY_HEADERS } from '../lib/http.js';
import { WEB_ROOT, resolveStatic, serveFile, sendBody, etagFor } from './static.js';
import { baseUrl, robotsTxt, sitemapXml } from './seo.js';
import { renderPage } from './layout.js';
import { homePage, privacyPage, termsPage, notFoundPage, badRequestPage } from './pages.js';

const PAGES = { '/': homePage, '/privacy': privacyPage, '/terms': termsPage };
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function redirect(res, location, status = 301) {
  res.writeHead(status, { ...SECURITY_HEADERS, Location: location, 'Cache-Control': 'no-cache', 'Content-Length': 0 });
  res.end();
}

// Canonical host and scheme. Applies to GET/HEAD only so form posts and API writes are never redirected.
// Local hosts and the health check are exempt so local development and load-balancer probes keep working.
export function canonicalRedirect(req, config, url) {
  if (!config.siteUrl || !['GET', 'HEAD'].includes(req.method) || url.pathname === '/api/health') return null;
  const target = new URL(config.siteUrl);
  const host = String(req.headers.host ?? '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  if (!host || LOCAL_HOSTS.has(hostname)) return null;
  const wrongHost = host !== target.host;
  const plainHttp = config.trustProxy && target.protocol === 'https:' && String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'http';
  return wrongHost || plainHttp ? `${target.origin}${url.pathname}${url.search}` : null;
}

function sendPage(req, res, config, page, status = 200) {
  const html = renderPage({ base: baseUrl(config, req), config, page });
  sendBody(req, res, { status, type: 'text/html; charset=utf-8', body: Buffer.from(html), etag: etagFor(html), cacheControl: 'no-cache',
    headers: page.indexable ? {} : { 'X-Robots-Tag': 'noindex' } });
}

function sendText(req, res, type, text) {
  sendBody(req, res, { type, body: Buffer.from(text), etag: etagFor(text), cacheControl: 'public, max-age=3600' });
}

export function handlePublic(req, res, config, url) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { sendPage(req, res, config, badRequestPage(), 400); return; }

  // Normalise duplicate URL forms to one canonical address.
  if (pathname === '/index.html') { redirect(res, `/${url.search}`); return; }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const trimmed = pathname.replace(/\/+$/, '');
    if (PAGES[trimmed] || trimmed === '/app') { redirect(res, `${trimmed}${url.search}`); return; }
  }

  if (PAGES[pathname]) { sendPage(req, res, config, PAGES[pathname](config)); return; }
  if (pathname === '/app') { serveFile(req, res, path.join(WEB_ROOT, 'index.html'), { extraHeaders: { 'X-Robots-Tag': 'noindex' } }); return; }
  if (pathname === '/robots.txt') { sendText(req, res, 'text/plain; charset=utf-8', robotsTxt(baseUrl(config, req))); return; }
  if (pathname === '/sitemap.xml') { sendText(req, res, 'application/xml; charset=utf-8', sitemapXml(baseUrl(config, req))); return; }

  const file = resolveStatic(pathname);
  if (file) { serveFile(req, res, file); return; }
  sendPage(req, res, config, notFoundPage(), 404);
}
