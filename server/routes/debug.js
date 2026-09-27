import { Router } from 'express';
import { getRecentErrors, getErrorById, clearErrorLog } from '../lib/errorLog.js';

// These endpoints exist for Akash — WriteMate's own backend developer — to
// look up the full technical detail behind a customer-facing error code +
// reference id, then reproduce the same request directly in Postman. They
// never return the user's actual text/context/API key (see errorLog.js), so
// there's nothing sensitive in a response even in personal mode, where the
// server only ever binds to 127.0.0.1 (see server/index.js).
//
// server/index.js only mounts this router when
// WRITEMATE_ENABLE_DEBUG_ENDPOINT isn't explicitly set to "false" — see the
// comment there. If WriteMate is ever run as a shared network backend
// (Phase G / Mode B in the brief), turn this off (or put it behind its own
// auth) before exposing the server beyond localhost, since these responses
// — while free of message content — do reveal internal error detail
// (provider names, HTTP statuses, stack-adjacent messages) that shouldn't
// be handed to an arbitrary network caller.
export const debugRouter = Router();

debugRouter.get('/debug/errors', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  res.json({ errors: getRecentErrors(limit) });
});

debugRouter.get('/debug/errors/:id', (req, res) => {
  const entry = getErrorById(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: `No logged error found with id "${req.params.id}".` });
  }
  res.json(entry);
});

debugRouter.delete('/debug/errors', (req, res) => {
  clearErrorLog();
  res.json({ ok: true });
});
