// Public site: routing, status codes, redirects, technical SEO metadata, sitemap/robots, structured data,
// static delivery (compression, ETags) and production configuration checks.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startApp } from './helpers.js';
import { loadConfig, productionConfigProblems, parseSiteUrl } from '../server/config.js';
import { INDEXABLE } from '../server/site/seo.js';

let env;
before(async () => { env = await startApp(); });
after(async () => { await env.stop(); });

const get = (p, headers = {}) => fetch(env.base + p, { headers, redirect: 'manual' });
const meta = (html, attr, key) => {
  const m = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html);
  return m ? m[1] : null;
};

test('public pages return 200 with unique titles, descriptions and exactly one h1', async () => {
  const seen = { titles: new Set(), descriptions: new Set(), h1: new Set() };
  for (const { path } of INDEXABLE) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /^<!doctype html>\n<html lang="en">/);
    const title = /<title>([^<]+)<\/title>/.exec(html)[1];
    const description = meta(html, 'name', 'description');
    assert.ok(title.length >= 15 && title.length <= 65, `${path} title length ${title.length}`);
    assert.ok(description.length >= 70 && description.length <= 170, `${path} description length ${description.length}`);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    assert.equal(h1s.length, 1, `${path} must have exactly one h1`);
    const h1 = /<h1>([^<]+)<\/h1>/.exec(html)[1];
    for (const [k, v] of [['titles', title], ['descriptions', description], ['h1', h1]]) {
      assert.ok(!seen[k].has(v), `duplicate ${k}: ${v}`);
      seen[k].add(v);
    }
    assert.equal(meta(html, 'name', 'robots'), 'index, follow');
    assert.ok(!/—/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `${path} copy should not use em dashes`);
  }
});

test('headings do not skip levels on any public page', async () => {
  for (const { path } of INDEXABLE) {
    const html = await (await get(path)).text();
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `${path}: h${levels[i - 1]} followed by h${levels[i]}`);
  }
});

test('canonical, Open Graph and Twitter metadata are absolute and consistent', async () => {
  for (const { path } of INDEXABLE) {
    const html = await (await get(path)).text();
    const canonical = /<link rel="canonical" href="([^"]+)">/.exec(html)[1];
    assert.equal(canonical, `${env.base}${path === '/' ? '/' : path}`);
    assert.equal(meta(html, 'property', 'og:url'), canonical);
    assert.match(meta(html, 'property', 'og:image'), /^http:\/\/127\.0\.0\.1:\d+\/assets\/og-image\.png$/);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image');
    assert.ok(meta(html, 'property', 'og:title') && meta(html, 'property', 'og:description'));
    const img = await get(new URL(meta(html, 'property', 'og:image')).pathname);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
  }
});

test('structured data is valid JSON-LD with matching breadcrumbs and no ratings or reviews', async () => {
  for (const { path } of INDEXABLE) {
    const html = await (await get(path)).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(blocks.length, 1, path);
    const data = JSON.parse(blocks[0][1]);
    assert.equal(data['@context'], 'https://schema.org');
    const types = data['@graph'].map((n) => n['@type']);
    assert.ok(types.includes('WebSite') && types.includes('WebPage'), path);
    assert.ok(!/aggregateRating|review|offers|ratingValue/i.test(blocks[0][1]), 'no ratings, reviews or offers');
    assert.ok(!types.includes('Organization'), 'no Organization without a configured operator');
    const ids = new Set(data['@graph'].map((n) => n['@id']));
    assert.equal(ids.size, data['@graph'].length, 'unique @id values');
    const crumbs = data['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    if (path === '/') {
      assert.ok(types.includes('SoftwareApplication'));
      assert.equal(crumbs, undefined);
    } else {
      const visible = [...html.matchAll(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/g)][0][0];
      const names = [...visible.matchAll(/>([^<>]+)<\/(a|span)>/g)].map((m) => m[1]);
      assert.deepEqual(crumbs.itemListElement.map((i) => i.name), names, 'visible breadcrumbs match BreadcrumbList');
      assert.equal(crumbs.itemListElement.at(-1).item, `${env.base}${path}`);
    }
  }
});

test('images have explicit dimensions and alt text; decorative images use empty alt', async () => {
  const html = await (await get('/')).text();
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length >= 2);
  for (const tag of imgs) {
    assert.match(tag, /\balt="[^"]*"/, tag);
    assert.match(tag, /\bwidth="\d+"/, tag);
    assert.match(tag, /\bheight="\d+"/, tag);
  }
  const hero = imgs.find((t) => t.includes('dashboard-1280'));
  assert.match(hero, /alt="Compliance dashboard showing/);
  for (const src of ['/assets/dashboard-1280.jpg', '/assets/dashboard-640.jpg', '/assets/dashboard-1280.webp', '/assets/dashboard-640.webp']) {
    assert.equal((await get(src)).status, 200, src);
  }
});

test('every internal link on public pages resolves', async () => {
  const targets = new Set();
  for (const { path } of INDEXABLE) {
    const html = await (await get(path)).text();
    for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)) targets.add(m[1] || '/');
    for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) targets.add(part.trim().split(' ')[0]);
  }
  for (const t of targets) assert.equal((await get(t)).status, 200, `broken internal link: ${t}`);
});

test('unknown routes return a 404 page that is not indexable', async () => {
  for (const p of ['/does-not-exist', '/app/anything', '/assets/missing.png', '/web/index.html', '/..%2fpackage.json']) {
    const res = await get(p);
    assert.equal(res.status, 404, p);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex');
    const html = await res.text();
    assert.match(html, /<h1>Page not found<\/h1>/);
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.ok(!html.includes('rel="canonical"'));
    assert.ok(!html.includes('"dependencies"'));
  }
  const api = await get('/api/does-not-exist');
  assert.equal(api.status, 404);
  assert.match(api.headers.get('content-type'), /application\/json/);
});

test('malformed URLs return 400 instead of a server error', async () => {
  const res = await get('/%E0%A4%A');
  assert.equal(res.status, 400);
});

test('duplicate URL forms redirect permanently to one canonical address', async () => {
  for (const [from, to] of [['/privacy/', '/privacy'], ['/terms/', '/terms'], ['/app/', '/app'], ['/index.html', '/'], ['/privacy/?x=1', '/privacy?x=1']]) {
    const res = await get(from);
    assert.equal(res.status, 301, from);
    assert.equal(res.headers.get('location'), to, from);
  }
});

test('non-GET requests to pages are rejected with 405', async () => {
  const res = await fetch(`${env.base}/privacy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
});

test('the application shell is served at /app and kept out of search indexes', async () => {
  const res = await get('/app');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  const html = await res.text();
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /<script src="\/app\.js" defer><\/script>/);
});

test('robots.txt and sitemap.xml are valid and agree with the indexable pages', async () => {
  const robots = await get('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type'), /^text\/plain/);
  const rt = await robots.text();
  assert.match(rt, /^User-agent: \*$/m);
  assert.match(rt, /^Disallow: \/app$/m);
  assert.match(rt, /^Disallow: \/api\/$/m);
  assert.ok(!/^Disallow: \/$/m.test(rt), 'must not block the whole site');
  assert.match(rt, new RegExp(`^Sitemap: ${env.base}/sitemap\\.xml$`, 'm'));

  const sm = await get('/sitemap.xml');
  assert.equal(sm.status, 200);
  assert.match(sm.headers.get('content-type'), /^application\/xml/);
  const xml = await sm.text();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, INDEXABLE.map((p) => `${env.base}${p.path}`));
  for (const loc of locs) {
    const res = await get(new URL(loc).pathname);
    assert.equal(res.status, 200, loc);
    const canonical = /<link rel="canonical" href="([^"]+)">/.exec(await res.text())[1];
    assert.equal(canonical, loc, 'sitemap URL equals the page canonical');
  }
  assert.ok(!locs.some((l) => /\/app|\/api/.test(l)), 'private routes excluded');
});

test('favicon set and web manifest are served with correct types', async () => {
  const ico = await get('/favicon.ico');
  assert.equal(ico.status, 200);
  assert.equal(ico.headers.get('content-type'), 'image/x-icon');
  const buf = Buffer.from(await ico.arrayBuffer());
  assert.equal(buf.readUInt16LE(2), 1, 'ICO type');
  assert.equal(buf.readUInt16LE(4), 2, 'two images');
  for (const [p, type] of [['/assets/favicon.svg', 'image/svg+xml'], ['/assets/apple-touch-icon.png', 'image/png'], ['/site.webmanifest', 'application/manifest+json']]) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.equal(r.headers.get('content-type'), type, p);
  }
  const manifest = await (await get('/site.webmanifest')).json();
  for (const icon of manifest.icons) assert.equal((await get(icon.src)).status, 200, icon.src);
});

test('static text assets are compressed and revalidate with ETags', async () => {
  for (const enc of ['br', 'gzip']) {
    const res = await get('/app.js', { 'Accept-Encoding': enc });
    assert.equal(res.headers.get('content-encoding'), enc);
    assert.equal(res.headers.get('vary'), 'Accept-Encoding');
    await res.arrayBuffer();
  }
  const first = await get('/site.css', { 'Accept-Encoding': 'gzip' });
  const etag = first.headers.get('etag');
  assert.ok(etag);
  await first.arrayBuffer();
  const again = await get('/site.css', { 'Accept-Encoding': 'gzip', 'If-None-Match': etag });
  assert.equal(again.status, 304);
  const plain = await get('/site.css', { 'Accept-Encoding': 'identity' });
  assert.equal(plain.headers.get('content-encoding'), null);
  assert.notEqual(plain.headers.get('etag'), etag, 'each encoding has its own ETag');
  const png = await get('/assets/og-image.png', { 'Accept-Encoding': 'br' });
  assert.equal(png.headers.get('content-encoding'), null, 'images are not recompressed');
  assert.match(png.headers.get('cache-control'), /max-age=/);
  const page = await get('/', { 'Accept-Encoding': 'br' });
  assert.equal(page.headers.get('content-encoding'), 'br');
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});

test('legal pages reflect configuration: no operator in development, operator details when configured', async () => {
  const dev = await (await get('/privacy')).text();
  assert.match(dev, /operator has not been configured/);
  assert.match(dev, /does not send any data to an external AI model provider/);
  const configured = await startApp();
  try {
    configured.app.config.operatorName = 'Example Compliance Services Ltd';
    configured.app.config.contactEmail = 'privacy@example.com';
    configured.app.config.ai.provider = 'anthropic';
    const html = await (await fetch(`${configured.base}/privacy`)).text();
    assert.match(html, /operated by <strong>Example Compliance Services Ltd<\/strong>/);
    assert.match(html, /mailto:privacy@example\.com/);
    assert.match(html, /uses Claude, a model provided by Anthropic/);
    const home = await (await fetch(`${configured.base}/`)).text();
    const data = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(home)[1]);
    const org = data['@graph'].find((n) => n['@type'] === 'Organization');
    assert.equal(org.name, 'Example Compliance Services Ltd');
    assert.equal(data['@graph'].find((n) => n['@type'] === 'WebSite').publisher['@id'], org['@id']);
  } finally { await configured.stop(); }
});

test('canonical host and HTTPS redirects use SITE_URL, exempting local hosts and the health check', async () => {
  const site = await startApp();
  try {
    site.app.config.siteUrl = 'https://compliance.example.zm';
    site.app.config.trustProxy = true;
    // fetch() does not allow overriding the Host header, so use node:http directly.
    const req = (p, headers = {}, method = 'GET', body = null) => new Promise((resolve, reject) => {
      const u = new URL(site.base + p);
      const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
        let text = '';
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: { get: (k) => res.headers[k.toLowerCase()] ?? null }, text: async () => text }));
      });
      r.on('error', reject);
      if (body) r.write(body);
      r.end();
    });
    let r = await req('/privacy?a=1', { Host: 'www.compliance.example.zm' });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://compliance.example.zm/privacy?a=1');
    r = await req('/', { Host: 'compliance.example.zm', 'X-Forwarded-Proto': 'http' });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get('location'), 'https://compliance.example.zm/');
    r = await req('/', { Host: 'compliance.example.zm', 'X-Forwarded-Proto': 'https' });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /<link rel="canonical" href="https:\/\/compliance\.example\.zm\/">/);
    r = await req('/api/health', { Host: '10.0.0.5:3000' });
    assert.equal(r.status, 200, 'health checks are not redirected');
    r = await req('/', {});
    assert.equal(r.status, 200, 'local development host is not redirected');
    const robots = await (await req('/robots.txt', { Host: 'compliance.example.zm' })).text();
    assert.match(robots, /Sitemap: https:\/\/compliance\.example\.zm\/sitemap\.xml/);
    const post = await req('/api/auth/login', { Host: 'www.compliance.example.zm', 'Content-Type': 'application/json' }, 'POST', '{}');
    assert.notEqual(post.status, 301, 'writes are never redirected');
  } finally { await site.stop(); }
});

test('rendered pages and the app shell are valid HTML (html-validate recommended rules)', async () => {
  const { HtmlValidate } = await import('html-validate');
  // Lowercase <!doctype html> is valid HTML5; that rule is purely stylistic.
  const validator = new HtmlValidate({ extends: ['html-validate:recommended'], rules: { 'doctype-style': 'off' } });
  for (const p of [...INDEXABLE.map((x) => x.path), '/does-not-exist', '/app']) {
    const html = await (await get(p)).text();
    const report = await validator.validateString(html, `${p}.html`);
    const messages = report.results.flatMap((r) => r.messages.map((m) => `${m.ruleId}: ${m.message} (line ${m.line})`));
    assert.deepEqual(messages, [], `${p}\n${messages.join('\n')}`);
  }
});

test('production configuration is validated before start-up', () => {
  assert.throws(() => parseSiteUrl('compliance.example.zm'), /absolute URL/);
  assert.throws(() => parseSiteUrl('https://x.zm/path'), /origin only/);
  assert.throws(() => parseSiteUrl('ftp://x.zm'), /http or https/);
  assert.equal(parseSiteUrl('https://Compliance.Example.zm/'), 'https://compliance.example.zm');
  const empty = loadConfig({ env: { NODE_ENV: 'production', SITE_URL: '', OPERATOR_NAME: '', CONTACT_EMAIL: '' } });
  assert.equal(empty.production, true);
  const problems = productionConfigProblems({ ...empty, dataKeyHex: null, secureCookies: false });
  for (const key of ['SITE_URL', 'DATA_KEY', 'SECURE_COOKIES', 'OPERATOR_NAME', 'CONTACT_EMAIL']) assert.ok(problems.some((p) => p.startsWith(key)), key);
  const ok = loadConfig({ env: { NODE_ENV: 'production', SITE_URL: 'https://compliance.example.zm', OPERATOR_NAME: 'Example Ltd', CONTACT_EMAIL: 'privacy@example.com' } });
  assert.deepEqual(productionConfigProblems({ ...ok, dataKeyHex: 'ab'.repeat(32), secureCookies: true }), []);
  assert.ok(productionConfigProblems({ ...ok, siteUrl: 'http://compliance.example.zm', dataKeyHex: 'ab'.repeat(32), secureCookies: true })[0].includes('https'));
});
