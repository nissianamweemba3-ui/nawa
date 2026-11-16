// Static delivery for the public site and the web client: explicit allow-list, ETag revalidation,
// Brotli/gzip compression for text types, and per-type cache policy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { ROOT } from '../config.js';
import { SECURITY_HEADERS } from '../lib/http.js';

export const WEB_ROOT = path.join(ROOT, 'web');
const ASSET_DIR = path.join(WEB_ROOT, 'assets');

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = /^(text\/|application\/(xml|manifest\+json)|image\/svg\+xml)/;

// Fixed public paths for the web client and stylesheets.
const FIXED = {
  '/app.js': 'app.js',
  '/styles.css': 'styles.css',
  '/tokens.css': 'tokens.css',
  '/site.css': 'site.css',
  '/favicon.ico': 'assets/favicon.ico',
  '/site.webmanifest': 'site.webmanifest',
};

// Resolves a request path to a file under web/, or null. Only allow-listed names are served.
export function resolveStatic(pathname) {
  if (FIXED[pathname]) return path.join(WEB_ROOT, FIXED[pathname]);
  const m = /^\/assets\/([a-z0-9][a-z0-9-]*\.(svg|png|jpg|webp|ico))$/.exec(pathname);
  if (!m) return null;
  const file = path.join(ASSET_DIR, m[1]);
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const cache = new Map();

function variants(file) {
  const stat = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit;
  const body = fs.readFileSync(file);
  const entry = { mtimeMs: stat.mtimeMs, size: stat.size, body, etag: `"${crypto.createHash('sha1').update(body).digest('base64url')}"`, encoded: {} };
  cache.set(file, entry);
  return entry;
}

export function pickEncoding(req, type) {
  if (!COMPRESSIBLE.test(type)) return null;
  const accept = String(req.headers['accept-encoding'] ?? '');
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  return null;
}

export function compress(body, encoding) {
  if (encoding === 'br') return zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
  if (encoding === 'gzip') return zlib.gzipSync(body, { level: 9 });
  return body;
}

function etagMatches(req, etag) {
  const inm = req.headers['if-none-match'];
  if (!inm) return false;
  return inm.split(',').map((s) => s.trim().replace(/^W\//, '')).includes(etag);
}

// Sends a body with ETag/304 handling and content negotiation. Used for files and rendered pages alike.
export function sendBody(req, res, { status = 200, type, body, etag, cacheControl, headers = {}, encodedCache = null }) {
  const encoding = pickEncoding(req, type);
  const tag = encoding ? `${etag.slice(0, -1)}-${encoding}"` : etag;
  const base = { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': cacheControl, ETag: tag, Vary: 'Accept-Encoding', ...headers };
  if (status === 200 && etagMatches(req, tag)) {
    res.writeHead(304, base);
    res.end();
    return;
  }
  let payload = body;
  if (encoding) {
    payload = encodedCache?.[encoding] ?? compress(body, encoding);
    if (encodedCache) encodedCache[encoding] = payload;
    base['Content-Encoding'] = encoding;
  }
  base['Content-Length'] = payload.length;
  res.writeHead(status, base);
  res.end(req.method === 'HEAD' ? undefined : payload);
}

export function serveFile(req, res, file, { extraHeaders = {} } = {}) {
  const entry = variants(file);
  const ext = path.extname(file);
  const type = TYPES[ext] ?? 'application/octet-stream';
  // Images and icons change rarely; scripts, styles and HTML revalidate on every load (cheap with ETag).
  const cacheControl = ['.png', '.jpg', '.webp', '.ico', '.svg'].includes(ext) ? 'public, max-age=86400' : 'no-cache';
  sendBody(req, res, { type, body: entry.body, etag: entry.etag, cacheControl, headers: extraHeaders, encodedCache: entry.encoded });
}

export function etagFor(text) {
  return `"${crypto.createHash('sha1').update(text).digest('base64url')}"`;
}
