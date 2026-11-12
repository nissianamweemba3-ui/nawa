// Role-based access control. Organisation roles grant tenant permissions; platform roles grant
// knowledge-base and regulatory governance permissions (they do NOT grant access to any tenant's data).
import { forbidden } from '../lib/http.js';

const VIEW = ['org.read', 'assessment.read', 'evidence.read', 'task.read', 'kb.read', 'insights.read', 'regulatory.read'];
const CONTRIBUTE = [...VIEW, 'assessment.create', 'evidence.upload', 'task.update', 'ai.use', 'document.analyse', 'document.generate'];
const OFFICER = [...CONTRIBUTE, 'task.create', 'finding.review', 'regulatory.acknowledge', 'insights.executive', 'org.update', 'audit.read'];
const ADMIN = [...OFFICER, 'member.manage'];

export const ORG_ROLE_PERMISSIONS = {
  viewer: new Set(VIEW),
  contributor: new Set(CONTRIBUTE),
  compliance_officer: new Set(OFFICER),
  admin: new Set(ADMIN),
  owner: new Set([...ADMIN, 'org.owner']),
};

export const PLATFORM_ROLE_PERMISSIONS = {
  user: new Set(),
  legal_reviewer: new Set(['kb.review', 'regulatory.review', 'kb.governance.read']),
  platform_admin: new Set(['kb.ingest', 'regulatory.capture', 'kb.governance.read']),
};

export const ORG_ROLES = Object.keys(ORG_ROLE_PERMISSIONS);

export function hasPermission(ctx, perm) {
  if (!ctx) return false;
  if (ctx.orgRole && ORG_ROLE_PERMISSIONS[ctx.orgRole]?.has(perm)) return true;
  return PLATFORM_ROLE_PERMISSIONS[ctx.platformRole]?.has(perm) ?? false;
}

export function requirePermission(ctx, perm) {
  if (!hasPermission(ctx, perm)) throw forbidden(`Missing permission: ${perm}`);
}

// Tenant permissions additionally require an active organisation in the session.
export function requireOrgPermission(ctx, perm) {
  if (!ctx?.orgId || !ctx.orgRole) throw forbidden('Select an organisation first');
  if (!ORG_ROLE_PERMISSIONS[ctx.orgRole]?.has(perm)) throw forbidden(`Missing permission: ${perm}`);
}
