import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRewriteRouter } from './routes/rewrite.js';
import { settingsRouter } from './routes/settings.js';
import { styleRouter } from './routes/style.js';
import { historyRouter } from './routes/history.js';
import { termsRouter } from './routes/terms.js';
import { profilesRouter } from './routes/profiles.js';
import { templatesRouter } from './routes/templates.js';
import { metaRouter } from './routes/meta.js';
import { debugRouter } from './routes/debug.js';
import { createRateLimiter } from './lib/rateLimit.js';
import { ErrorCodes } from './lib/errorCodes.js';
import { recordError } from './lib/errorLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Builds and starts the WriteMate server. Exported (rather than only run as
 * a side effect of importing this file) so the Electron desktop app can
 * start it in-process — no separate `node` child process needed, since
 * Electron's main process already is Node — and get back a handle to stop
 * it cleanly on app quit. Running `node server/index.js` directly (what
 * `npm run dev` / `npm start` do) still works exactly as before, via the
 * auto-start block at the bottom of this file.
 *
 * @param {{ port?: number }} [options]
 * @returns {{ app: import('express').Express, server: import('http').Server, port: number }}
 */
export function startServer(options = {}) {
  const PORT = Number(options.port || process.env.PORT || 4173);
  const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);

  const app = express();

  // This app is meant to run on your own machine, for your own use — it
  // binds to localhost only (see app.listen below). If you ever expose it
  // beyond localhost, add authentication first (see PRIVACY.md).
  app.use(express.json({ limit: '1mb' }));

  // IMPORTANT (privacy): nothing here logs request bodies, so message
  // content and API keys never end up in a terminal or log file.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  const rateLimiter = createRateLimiter({ perMinute: RATE_LIMIT_PER_MINUTE });

  app.use('/api', createRewriteRouter(rateLimiter));
  app.use('/api', settingsRouter);
  app.use('/api', styleRouter);
  app.use('/api', historyRouter);
  app.use('/api', termsRouter);
  app.use('/api', profilesRouter);
  app.use('/api', templatesRouter);
  app.use('/api', metaRouter);

  // Debug/troubleshooting endpoints (GET /api/debug/errors, GET
  // /api/debug/errors/:id, DELETE /api/debug/errors) — see routes/debug.js
  // and errorLog.js. On by default for personal/local mode (the server only
  // binds to 127.0.0.1, see app.listen below); set
  // WRITEMATE_ENABLE_DEBUG_ENDPOINT=false in .env to turn it off, which
  // matters if this server is ever run as a shared network backend
  // (Phase G / Mode B in the brief) rather than a personal desktop app.
  const debugEndpointEnabled = (process.env.WRITEMATE_ENABLE_DEBUG_ENDPOINT ?? 'true') !== 'false';
  if (debugEndpointEnabled) {
    app.use('/api', debugRouter);
  } else {
    console.log('Debug endpoint disabled (WRITEMATE_ENABLE_DEBUG_ENDPOINT=false).');
  }

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Fallback error handler — never echoes stack traces or request bodies to
  // the customer; the technical message is only ever written to the local
  // error log (see errorLog.js), keyed by the same code + id shown here.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const entry = ErrorCodes.UNEXPECTED_SERVER_ERROR;
    const errorId = recordError(entry, {
      httpStatus: entry.httpStatus,
      endpoint: req.path,
      technicalMessage: err.message,
    });
    console.error(`Unhandled error on ${req.method} ${req.path}: ${err.message} (code ${entry.code}, ref ${errorId})`);
    res.status(entry.httpStatus).json({ error: entry.message(), code: entry.code, errorId });
  });

  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  WriteMate AI is running: http://localhost:${PORT}\n`);
  });

  return { app, server, port: PORT };
}

// Auto-start only when this file is run directly (`node server/index.js`,
// which is what `npm run dev` / `npm start` do) — not when it's imported as
// a module (e.g. by electron/main.js), so the importer controls when/if the
// server starts.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startServer();
}
