// WriteMate AI — optional OS-level encryption for stored API keys (Phase D).
//
// When this code runs inside the Electron desktop build, Electron's
// `safeStorage` API is available and uses the OS's own credential vault
// (DPAPI on Windows, Keychain on macOS, libsecret on Linux) to encrypt
// values with a key tied to the logged-in user account — so
// data/settings.json (or the Electron userData equivalent) never holds a
// plaintext API key on disk, only ciphertext only that same Windows user
// account can decrypt.
//
// When this code runs as a plain Node process (`npm run dev` / `npm start`,
// no Electron), `safeStorage` doesn't exist — encryption is skipped and
// values are stored as plain text, exactly as before this change. This
// keeps the existing web-only workflow working unmodified; encryption is
// strictly an upgrade that only applies inside the packaged desktop app.
//
// Values are stored as a plain string either way, so no other schema
// change is needed: an encrypted value is prefixed "enc:v1:" + base64
// ciphertext; anything else (including "", null, or a pre-existing
// plaintext key from before this change) is treated as plaintext and
// passed through untouched.

import { createRequire } from 'node:module';

// This module is ESM (project-wide "type": "module"), but `electron` is a
// CommonJS package best resolved synchronously — store.js's read/write API
// is synchronous throughout, and keeping this synchronous avoids a much
// larger refactor. createRequire gives us a real, working require() from
// inside an ESM file for exactly this kind of case.
const require = createRequire(import.meta.url);

const PREFIX = 'enc:v1:';

let electronModule = null;
let triedLoadingElectron = false;

function getElectronSafeStorage() {
  if (!triedLoadingElectron) {
    triedLoadingElectron = true;
    try {
      // Only resolves to a real API when this process was launched by the
      // Electron binary itself (main process). Under plain `node`, the
      // 'electron' package's export is just a filesystem path string, with
      // no `.safeStorage` — the isEncryptionAvailable() check below is what
      // actually gates real usage, not just presence of the property.
      electronModule = require('electron');
    } catch {
      electronModule = null;
    }
  }
  const safeStorage = electronModule && electronModule.safeStorage;
  if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
    return safeStorage;
  }
  return null;
}

/** Encrypts a secret if OS-level encryption is available; otherwise returns it unchanged. */
export function encryptSecret(value) {
  if (!value) return value;
  const safeStorage = getElectronSafeStorage();
  if (!safeStorage) return value; // plain Node / dev mode — unchanged behavior
  try {
    const buf = safeStorage.encryptString(value);
    return PREFIX + buf.toString('base64');
  } catch (err) {
    console.warn('Could not encrypt a secret with OS-level storage; saving as plain text instead:', err.message);
    return value;
  }
}

/** Reverses encryptSecret(); passes through anything not carrying our prefix. */
export function decryptSecret(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const safeStorage = getElectronSafeStorage();
  if (!safeStorage) {
    // Encrypted on a machine/user account safeStorage can't decrypt here
    // (e.g. moved data dir, or opened outside Electron). Fail safe: don't
    // return ciphertext as if it were a usable key.
    console.warn('Found an OS-encrypted setting but OS-level decryption is unavailable in this process; treating it as empty.');
    return '';
  }
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.warn('Could not decrypt a stored secret; treating it as empty:', err.message);
    return '';
  }
}
