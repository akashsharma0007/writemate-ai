# Privacy

WriteMate AI is designed to handle real work and customer messages, so privacy isn't an
afterthought — it's a default.

## What happens to your text

- Your text is sent **only** to the AI provider you configured in Settings (OpenAI,
  Anthropic, or a custom/local endpoint you chose), and **only** when you click
  **Generate** or **Try again**. Nothing is sent in the background, on page load, or
  while you're just typing.
- The server (running on your own machine) does **not** log request or response
  content. Its only console output is a method/path/status/timing line per request
  (e.g. `POST /api/rewrite -> 200 (842ms)`) — never the text itself, never an API key.
- There is no analytics, telemetry, or third-party tracking anywhere in this app.

## What's stored, and where

Everything WriteMate stores lives in plain JSON files under the local `data/` folder on
your machine (git-ignored — never committed if you put this in version control):

| File | Contents | Default |
|---|---|---|
| `settings.json` | provider choice, model, API keys, temperature/token limits, privacy toggles | created on first save |
| `writingStyle.json` | the style preferences you explicitly typed in | empty |
| `history.json` | past rewrites (date, action, tone, context, original, result) | **only written if History is turned on AND privacy mode is off** |
| `protectedTerms.json` | custom terms you added | empty |
| `profiles.json` / `templates.json` | your context profiles / templates | seeded with the built-in defaults |
| `error-log.json` | technical detail for errors that happen (error code, HTTP status, provider name, text *length* only, timestamp) | always written when a request fails — see below |

None of this is ever transmitted anywhere except your own browser talking to your own
locally-running server.

## The error log (`error-log.json`) and the debug endpoints

When something goes wrong — the AI provider rejects the request, times out, or returns
something WriteMate can't parse — the person using the app sees a plain-English message
plus a short error code and reference id (e.g. "WM-1004 · ref 1A2B3C"), never a raw
provider error or a stack trace.

The technical detail behind that code+id is written to `data/error-log.json` so it can be
looked up later — but that entry **never contains the submitted text, the context box, or
any API key**. It only ever holds metadata: the error code, the HTTP status involved,
which provider was in use, the *length* (not content) of the text that was being
processed, and the underlying technical message a provider or Node produced. This is why
the error log isn't gated by privacy mode ("do not save my text") — there's nothing in it
that toggle is meant to protect in the first place.

Three endpoints exist to read it back — meant for whoever is running/maintaining this
install (e.g. via Postman), not for end users:

- `GET /api/debug/errors` — the most recent entries.
- `GET /api/debug/errors/:id` — full detail for one reference id.
- `DELETE /api/debug/errors` — clears the log.

These are on by default because, in personal mode, the server only binds to `127.0.0.1` —
nothing outside your own machine can reach them. If you ever run WriteMate as a shared
backend other people connect to over a network (see "Self-hosting modes" in
`DEVELOPMENT.md`), set `WRITEMATE_ENABLE_DEBUG_ENDPOINT=false` in `.env` (or put these
routes behind their own auth) before exposing the server beyond localhost — the entries
are free of message content, but they do reveal internal error detail that shouldn't be
handed to an arbitrary caller.

## Privacy mode ("Do not save my text")

**On by default.** While enabled, History never records anything — even if you also
have the History toggle switched on — because privacy mode is treated as the overriding
setting. Turn it off deliberately in Settings if you want History to actually record.

**Clear current text** (Write view) instantly wipes the original text, context, and
custom instruction fields from the page — nothing to undo, nothing recoverable, because
nothing was stored.

**Delete History** (History view) removes individual entries or everything, permanently,
immediately.

## API keys

- Entered from the Settings page, they're written to `data/settings.json` on your own
  machine — never to any remote server, never logged, never rendered back to the page in
  plaintext (the Settings page shows a masked version like `••••••1a2b`).
- Entered via `.env` instead, they're read directly from the file by the server process
  and never touch the frontend at all.
- Either way, the browser (frontend) never sees a real API key — only the backend holds
  it and makes the outbound call.

## Protected values

The extraction/verification system (see `README.md` / `USER_GUIDE.md` → Protected Terms)
exists specifically so that customer identifiers, ticket numbers, dollar amounts, and
similar values are not silently altered by the AI. It's a best-effort safety net, not a
guarantee — always check the "Diff" view and any warnings before accepting a result that
contains sensitive or high-stakes values.

## Network exposure

The server binds to `127.0.0.1` (localhost) only — by default, nothing on your local
network, let alone the internet, can reach it. If you ever change this to serve other
people (see "Self-hosting modes" in `DEVELOPMENT.md`), you must add authentication and
HTTPS first; that configuration is intentionally not part of this personal-use MVP.

## Input limits & timeouts

- Requests are capped at `MAX_INPUT_CHARS` (default 8000 characters) and rate-limited to
  `RATE_LIMIT_PER_MINUTE` (default 20/minute) — both configurable in `.env` — mainly to
  prevent runaway API costs from a bug or an accidental loop, not because of any data
  concern.
- Every AI request has a hard timeout (`AI_REQUEST_TIMEOUT_MS`, default 30s) so a hung
  request can't block the app indefinitely.
