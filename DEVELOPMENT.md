# Development

## Layout

```
writemate-ai/
├── server/
│   ├── index.js              Express app entry point, static file serving, routing
│   ├── providers/            AIProvider abstraction
│   │   ├── AIProvider.js     Base class + fetchWithTimeout/ProviderError helpers
│   │   ├── OpenAIProvider.js
│   │   ├── AnthropicProvider.js
│   │   ├── CustomProvider.js OpenAI-compatible: local models, any hosted-compatible API
│   │   └── index.js          createProvider(settings) factory
│   ├── lib/
│   │   ├── promptBuilder.js  Builds the system/user prompt from all inputs (the "AI Engine")
│   │   ├── responseParser.js Defensive JSON parsing of the model's response
│   │   ├── protectedTerms.js Extraction + post-hoc verification of protected values
│   │   ├── diff.js           Word-level diff (wraps the `diff` package)
│   │   ├── store.js          Local JSON-file persistence (settings/style/history/terms/profiles/templates)
│   │   ├── effectiveSettings.js  Merges stored settings with .env fallbacks; masks keys for the frontend
│   │   └── rateLimit.js      In-memory sliding-window limiter
│   └── routes/               One file per resource: rewrite, settings, style, history, terms, profiles, templates, meta
├── public/                   Frontend — plain HTML/CSS/JS, no build step
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/                    node:test unit tests
├── data/                     Local JSON storage (git-ignored, created at runtime)
├── .env.example
└── package.json
```

## The AI Engine contract

Everything funnels through `buildPrompt()` in `server/lib/promptBuilder.js`, which
matches the brief's engine contract:

```
Input:  { text, context, tone, action, customInstruction, writingStyle, protectedTerms, profile, template }
Output (from the model, then parsed): { improvedText, changes, warnings, detectedTone }
                              (or, for action = "fix_grammar": { correctedText, issues, warnings })
```

`server/routes/rewrite.js` is the only place that wires all of this together:
extract protected terms → build prompt → call the active provider → parse the
response → verify protected terms survived → compute a diff → (optionally) record
history → respond.

## Adding a new rewrite action

1. Add an entry to `ACTIONS` in `server/lib/promptBuilder.js` (the instruction text sent
   to the model).
2. Add a label for it in `ACTION_LABELS` in `server/routes/meta.js`.
That's it — it automatically appears in the frontend's Action dropdown and template
editor, since both are populated from `/api/meta`.

## Adding a new AI provider

1. Create `server/providers/YourProvider.js` extending `AIProvider` (see
   `CustomProvider.js` for the simplest example — most providers are just "map our
   config to the provider's HTTP request shape").
2. Register it in `server/providers/index.js` (`createProvider` switch + add to
   `SUPPORTED_PROVIDERS`).
3. Add its config fields to `DEFAULTS.settings` in `server/lib/store.js`,
   `effectiveSettings.js`, `ALLOWED_KEYS` in `server/routes/settings.js`, and a
   `#providerFields-yourprovider` block in `public/index.html` + the show/hide logic in
   `public/app.js` (`updateProviderFieldsVisibility`).

## Tests

```bash
npm test
```

Runs Node's built-in test runner (`node --test tests/`) — no extra test framework
dependency. Covers:

- `protectedTerms.test.js` — extraction and verification logic.
- `promptBuilder.test.js` — prompt assembly for a few representative inputs.
- `diff.test.js` — word-level diff correctness.

There's deliberately no frontend test harness for this MVP (no build step to hook one
into) — exercise `public/app.js` manually against the running server, or add
Playwright later if the browser-extension/desktop phases warrant it.

## Self-hosting modes (for later — giving this to friends)

The brief calls for two modes:

- **Mode A — Personal** *(this MVP)*: everyone runs their own copy of this exact server,
  with their own API key. Simplest, cheapest for you (zero cost to you), most private
  for them.
- **Mode B — Shared**: you deploy one instance of `server/` somewhere reachable, and the
  server holds the API key(s) instead of each user. This requires, at minimum, before
  it's safe to expose beyond localhost:
  - Authentication (the current build has none — it assumes a single trusted local user)
  - HTTPS (a reverse proxy like Caddy/Nginx, or a platform that terminates TLS for you)
  - Per-user rate limiting (the current limiter is process-wide, not per-user)
  - Deciding whether history/settings become per-user (they're currently a single flat
    `data/` directory — fine for one person, not for multiple)

None of that is built yet — flagging it here so "just deploy the server folder
somewhere public" isn't mistaken for something this MVP already supports safely.

## Code style

Plain modern JS (ES modules, `async`/`await`), no TypeScript, no bundler, no linter
configured yet. Keep functions small and each file responsible for one thing — that's
what's kept this buildable as a single-evening MVP instead of a framework exercise.
