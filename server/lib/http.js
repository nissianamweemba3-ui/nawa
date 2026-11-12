// Minimal HTTP helpers: routing, JSON bodies, typed errors, security headers.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to perform this action') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const tooMany = (msg = 'Too many requests, please slow down') => new HttpError(429, msg);

// Explicit response wrapper. Handlers return plain data (sent as 200 JSON) or reply(status, body, headers).
export class Reply {
  constructor(status, body, headers = {}) { this.status = status; this.body = body; this.headers = headers; }
}
export const reply = (status, body, headers) => new Reply(status, body, headers);

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
    "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

export function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

export async function readJsonBody(req, limitBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw badRequest('Request body must be a JSON object');
  }
}

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    this.routes.push({ method, regex, keys, handler });
  }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  patch(p, h) { this.add('PATCH', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }
  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

// ---- input validation helpers ----
export function str(body, key, { required = true, max = 500, min = 0 } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`'${key}' is required`);
    return null;
  }
  if (typeof v !== 'string') throw badRequest(`'${key}' must be a string`);
  const t = v.trim();
  if (t.length < min) throw badRequest(`'${key}' must be at least ${min} characters`);
  if (t.length > max) throw badRequest(`'${key}' must be at most ${max} characters`);
  return t;
}

export function oneOf(body, key, allowed, { required = true } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`'${key}' is required`);
    return null;
  }
  if (!allowed.includes(v)) throw badRequest(`'${key}' must be one of: ${allowed.join(', ')}`);
  return v;
}

export function isoDate(body, key, { required = false } = {}) {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`'${key}' is required`);
    return null;
  }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw badRequest(`'${key}' must be a date in YYYY-MM-DD format`);
  }
  return v;
}

// Simple fixed-window limiter keyed by an arbitrary string.
export class RateLimiter {
  constructor(limit, windowMs = 60_000) { this.limit = limit; this.windowMs = windowMs; this.hits = new Map(); }
  check(key, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || now - entry.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }
}
