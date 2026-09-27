// WriteMate AI — local technical error log (for Akash, as the app's own
// backend developer, to troubleshoot with — never shown to a customer).
//
// PRIVACY: this file NEVER writes the user's submitted text, context, or
// any API key — only metadata about what went wrong (an error code, an HTTP
// status, which provider, non-content sizes like text length, and the
// underlying technical message a provider or Node itself produced). That's
// why this log isn't gated by the "do not save my text" privacy toggle —
// it never contains anything that toggle is protecting in the first place.
// See PRIVACY.md.
//
// Each entry gets a short id, which is also shown to the customer alongside
// the friendly message (see errorCodes.js + routes/rewrite.js) — the same
// id works on both sides: a customer reports "WM-1004, ref 1A2B3C", and
// GET /api/debug/errors/1A2B3C returns the full technical detail so you can
// reproduce the same request directly in Postman.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_ENTRIES = 500;

function dataDir() {
  const dir = process.env.WRITEMATE_DATA_DIR
    ? path.resolve(process.env.WRITEMATE_DATA_DIR)
    : path.resolve(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function logFilePath() {
  return path.join(dataDir(), 'error-log.json');
}

function readAll() {
  try {
    const raw = fs.readFileSync(logFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  const file = logFilePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

/**
 * Records one technical error entry and returns its id.
 *
 * @param {{ code: string }} errorCodeEntry - one of the ErrorCodes.* entries
 * @param {object} [detail] - metadata only (httpStatus, provider, endpoint,
 *   action, textLength, technicalMessage, upstreamStatus, ...) — never the
 *   user's actual text/context/API key.
 */
export function recordError(errorCodeEntry, detail = {}) {
  const id = makeId();
  const list = readAll();
  list.unshift({
    id,
    code: errorCodeEntry.code,
    timestamp: new Date().toISOString(),
    ...detail,
  });
  writeAll(list.slice(0, MAX_ENTRIES));
  return id;
}

export function getRecentErrors(limit = 50) {
  return readAll().slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

export function getErrorById(id) {
  return readAll().find((e) => e.id === id) || null;
}

export function clearErrorLog() {
  writeAll([]);
}
