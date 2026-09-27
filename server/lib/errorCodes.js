// WriteMate AI — customer-facing error catalog.
//
// The rest of the app throws/returns plain Errors and ProviderErrors full of
// technical detail (HTTP status codes, upstream response bodies, etc.) —
// useful for troubleshooting, but not something a non-technical customer
// should ever see raw. This file is the one place that turns "AI provider
// error (503): {\"error\":{\"code\":503,...}}" into something a customer can
// actually read and act on, while attaching a short, stable code (e.g.
// "WM-1004") they can quote back to support.
//
// The technical detail behind that code isn't thrown away — see
// errorLog.js, which records it locally (metadata only, never the user's
// text/context/API key) against a short reference id, so the same code +
// id can be looked up and the underlying request reproduced directly
// against these same API endpoints in Postman. See PRIVACY.md for exactly
// what this log does and doesn't contain.

export const ErrorCodes = {
  AI_NOT_CONFIGURED: {
    code: 'WM-1001',
    httpStatus: 400,
    message: (d) =>
      `WriteMate isn't connected to an AI provider yet. Open Settings, choose a provider, and add your API key, then try again.${
        d?.provider ? ` (Selected provider: ${d.provider})` : ''
      }`,
  },
  AI_AUTH_FAILED: {
    code: 'WM-1002',
    httpStatus: 502,
    message: () =>
      `The AI service didn't accept the API key on file. Please double-check it in Settings — it may be mistyped, expired, or revoked.`,
  },
  AI_RATE_LIMITED: {
    code: 'WM-1003',
    httpStatus: 502,
    message: () => `The AI service is receiving too many requests right now. Please wait about a minute and try again.`,
  },
  AI_UNAVAILABLE: {
    code: 'WM-1004',
    httpStatus: 502,
    message: () =>
      `The AI service is temporarily unavailable. This is usually short-lived on their end — please try again in a moment.`,
  },
  AI_NETWORK_ERROR: {
    code: 'WM-1005',
    httpStatus: 504,
    message: () => `WriteMate couldn't reach the AI service in time. Please check your internet connection and try again.`,
  },
  AI_RESPONSE_UNREADABLE: {
    code: 'WM-1006',
    httpStatus: 200, // still a usable (partial) result, not a failed request
    message: () => `The AI's response couldn't be fully understood this time — showing what could be recovered.`,
  },
  LOCAL_RATE_LIMIT: {
    code: 'WM-1007',
    httpStatus: 429,
    message: () => `You're sending requests a little too fast — please wait a few seconds and try again.`,
  },
  INPUT_MISSING_TEXT: {
    code: 'WM-1008',
    httpStatus: 400,
    message: () => `Please enter some text before generating.`,
  },
  INPUT_TOO_LONG: {
    code: 'WM-1009',
    httpStatus: 400,
    message: (d) => `That text is too long to process in one go (max ${d?.max ?? '?'} characters) — try splitting it up.`,
  },
  UNKNOWN_PROVIDER: {
    code: 'WM-1010',
    httpStatus: 400,
    message: (d) => `The selected AI provider ("${d?.provider ?? 'unknown'}") isn't recognized. Try re-selecting it in Settings.`,
  },
  UNEXPECTED_SERVER_ERROR: {
    code: 'WM-1099',
    httpStatus: 500,
    message: () =>
      `Something went wrong on WriteMate's side. Please try again — if it keeps happening, share the error code below when you report it.`,
  },
};

/**
 * Classifies a caught provider-call error (a ProviderError carrying an
 * upstream HTTP status, a timeout Error from fetchWithTimeout, or a raw
 * network Error) into one of the ErrorCodes entries above.
 *
 * This only ever looks at the error's status/message shape — never at
 * anything the user typed — so it's safe to call on any caught error.
 */
export function classifyProviderError(err) {
  const status = err && typeof err.status === 'number' ? err.status : undefined;

  if (status === 401 || status === 403) return ErrorCodes.AI_AUTH_FAILED;
  if (status === 429) return ErrorCodes.AI_RATE_LIMITED;
  if (status && status >= 500) return ErrorCodes.AI_UNAVAILABLE;

  const msg = (err && err.message) || '';
  if (/timed out/i.test(msg) || /fetch failed/i.test(msg) || /ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(msg)) {
    return ErrorCodes.AI_NETWORK_ERROR;
  }
  if (status) return ErrorCodes.AI_UNAVAILABLE; // some other 4xx/5xx we didn't special-case above
  return ErrorCodes.UNEXPECTED_SERVER_ERROR;
}
