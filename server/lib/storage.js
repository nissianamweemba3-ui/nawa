// Encrypted evidence storage. Files are encrypted with AES-256-GCM before touching disk and are stored
// under an opaque key inside a per-organisation directory, never under the user-supplied filename.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { encrypt, decrypt } from './crypto.js';

export function resolveDataKey(config) {
  if (config.dataKeyHex) {
    const key = Buffer.from(config.dataKeyHex, 'hex');
    if (key.length !== 32) throw new Error('DATA_KEY must be 64 hex characters (32 bytes)');
    return key;
  }
  // Development fallback: a random key persisted in the data directory (mode 0600).
  fs.mkdirSync(config.dataDir, { recursive: true });
  const keyFile = path.join(config.dataDir, '.data-key');
  if (fs.existsSync(keyFile)) return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  return key;
}

export class EvidenceStore {
  constructor(dir, key) {
    this.dir = dir;
    this.key = key;
    fs.mkdirSync(dir, { recursive: true });
  }

  pathFor(orgId, storageKey) {
    if (!/^[0-9a-f-]{36}$/.test(orgId) || !/^[0-9a-f-]{36}$/.test(storageKey)) throw new Error('Invalid storage key');
    return path.join(this.dir, orgId, `${storageKey}.bin`);
  }

  put(orgId, storageKey, buffer) {
    const p = this.pathFor(orgId, storageKey);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, encrypt(this.key, buffer), { mode: 0o600 });
  }

  get(orgId, storageKey) {
    return decrypt(this.key, fs.readFileSync(this.pathFor(orgId, storageKey)));
  }
}
