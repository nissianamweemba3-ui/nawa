// Operator command line for tasks the web application deliberately does not expose.
//   node server/admin-cli.js set-platform-role <email> <user|legal_reviewer|platform_admin>
// Platform roles govern the legal library and regulatory reviews; they cannot be self-assigned in the app.
import { loadConfig } from './config.js';
import { openDatabase } from './db.js';
import { audit } from './lib/audit.js';

const ROLES = ['user', 'legal_reviewer', 'platform_admin'];

export function setPlatformRole(db, email, role) {
  if (!ROLES.includes(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  const user = db.prepare('SELECT id, platform_role FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user) throw new Error(`No user is registered with ${email}. Ask them to register first.`);
  db.prepare('UPDATE users SET platform_role = ? WHERE id = ?').run(role, user.id);
  audit(db, { userId: null, action: 'admin.platform_role_change', target: user.id, metadata: { from: user.platform_role, to: role, via: 'admin-cli' } });
  return { from: user.platform_role, to: role };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const [command, email, role] = process.argv.slice(2);
  if (command !== 'set-platform-role' || !email || !role) {
    console.error('Usage: node server/admin-cli.js set-platform-role <email> <user|legal_reviewer|platform_admin>');
    process.exit(2);
  }
  const db = openDatabase(loadConfig().dbPath);
  try {
    const r = setPlatformRole(db, email, role);
    console.log(`Changed ${email} from ${r.from} to ${r.to}. Existing sessions pick up the new role on their next request.`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
