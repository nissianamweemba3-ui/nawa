// Tenant-scoped data access. Every query against a tenant table goes through a TenantRepo bound to the
// organisation in the authenticated session. The org_id is never taken from the request body or URL,
// so a user cannot address another tenant's rows even by guessing IDs. (PostgreSQL deployments add RLS.)
import { forbidden } from './lib/http.js';

const TENANT_TABLES = new Set(['assessments', 'evidence', 'tasks', 'doc_analyses', 'reg_notifications', 'ai_interactions']);
const IDENT = /^[a-z_][a-z0-9_]*$/;

function assertTable(table) {
  if (!TENANT_TABLES.has(table)) throw new Error(`Not a tenant table: ${table}`);
}

function assertColumns(cols) {
  for (const c of cols) if (!IDENT.test(c)) throw new Error(`Invalid column name: ${c}`);
}

export class TenantRepo {
  constructor(db, orgId) {
    if (!orgId) throw forbidden('No organisation context');
    this.db = db;
    this.orgId = orgId;
  }

  get(table, id) {
    assertTable(table);
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ? AND org_id = ?`).get(id, this.orgId) ?? null;
  }

  list(table, { where = {}, orderBy = 'created_at DESC', limit = 500 } = {}) {
    assertTable(table);
    const cols = Object.keys(where);
    assertColumns(cols);
    if (!/^[a-z_]+ (ASC|DESC)$/.test(orderBy)) throw new Error('Invalid orderBy');
    const clause = cols.map((c) => ` AND ${c} = ?`).join('');
    return this.db.prepare(`SELECT * FROM ${table} WHERE org_id = ?${clause} ORDER BY ${orderBy} LIMIT ?`)
      .all(this.orgId, ...cols.map((c) => where[c]), limit);
  }

  insert(table, row) {
    assertTable(table);
    const full = { ...row, org_id: this.orgId }; // org_id always forced from session context
    const cols = Object.keys(full);
    assertColumns(cols);
    this.db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => full[c]));
    return full;
  }

  update(table, id, changes) {
    assertTable(table);
    const cols = Object.keys(changes).filter((c) => c !== 'org_id' && c !== 'id');
    assertColumns(cols);
    if (cols.length === 0) return 0;
    const r = this.db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND org_id = ?`)
      .run(...cols.map((c) => changes[c]), id, this.orgId);
    return Number(r.changes);
  }

  organisation() {
    return this.db.prepare('SELECT * FROM organisations WHERE id = ?').get(this.orgId) ?? null;
  }
}
