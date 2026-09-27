# WriteMate AI

A free, self-hostable, privacy-first writing assistant — inspired by the *idea* of tools
like Grammarly, built from scratch with its own design, its own code, and no shared
branding or assets.

This is the **MVP (Phase 1)**: a local web app you run on your own machine, with your own
AI provider API key. It covers grammar fixing, tone/style rewriting, context-aware
generation, a diff view, protected technical terms, your own writing-style preferences,
context profiles, templates, and opt-in history — all stored locally, never on a server
you don't control.

See [`docs/ROADMAP.md`](#roadmap--whats-next) below for what Phase 2+ (browser extension,
desktop floating widget, Teams, Zoho) looks like.

## Download (prebuilt Windows app)

If you just want to run WriteMate AI rather than build it from source, grab the latest
release from this repo's **[Releases](../../releases)** page. Every release has two
options — pick whichever you prefer, both contain the exact same app:

- **`WriteMate AI Setup <version>.exe`** — a normal installer. Run it, click through the
  install wizard (no admin rights needed), and it adds Desktop + Start Menu shortcuts.
  Installs to `C:\WriteMate AI` by default.
- **`WriteMate AI-<version>-win.zip`** — a portable copy. Unzip it anywhere and run
  `WriteMate AI.exe` inside — nothing is installed or written outside that folder, so
  this is the option to use if you'd rather not run an installer at all, or you want to
  keep multiple versions side by side.

Either way, on first launch Windows SmartScreen may show an "unrecognized app" warning
(the app isn't code-signed — that costs money and isn't worth it for a free personal
tool) — click **More info → Run anyway** to proceed.

## What it does

- **Fix Grammar** — spelling, grammar, punctuation, sentence structure, subject/verb
  agreement, capitalization — shown as individual suggestions you Accept/Ignore, or
  Accept All.
- **Rewrite modes** — Improve, Rephrase, Professional, Friendly, Concise, Clearer,
  Confident, Diplomatic, Simplify, Expand, or a fully Custom instruction.
- **Tones** — Professional, Friendly, Formal, Casual, Confident, Diplomatic, Concise,
  Empathetic, Direct, Technical, Customer-Friendly, Executive, Neutral.
- **Context box** — tell it what you're actually trying to say; it's used alongside the
  original text, never as a replacement for it.
- **Protected terms** — ticket IDs, URLs, emails, dollar amounts, dates, version numbers,
  code spans, and any custom terms you add (e.g. `GA13`, `Orbit`, `CDB_CUSTOMER_INFO`) are
  extracted before the request is sent and verified afterward — if one goes missing from
  the result, you get a warning instead of a silent change.
- **Diff view** — word-level added/removed highlighting, plus a side-by-side view.
- **Accept / Copy / Try Again / Edit / Undo** on every result.
- **My Writing Style** — preferences you type in yourself; nothing is inferred or
  profiled silently.
- **Context Profiles** — Work / Internal / Personal presets, plus your own.
- **Templates** — Client Email, Internal Update, Ticket Response, Escalation, Status
  Update, Follow-up, Meeting Summary, Technical Explanation, plus your own.
- **History** — off by default (privacy mode). Turn it on in Settings if you want it.
- **Provider abstraction** — OpenAI, Anthropic, or any OpenAI-compatible endpoint
  (including a local model server like Ollama, for a fully free/local setup).

## Quick start

```bash
cd writemate-ai
npm install
cp .env.example .env
# edit .env and add your OpenAI or Anthropic API key (or leave it and set the
# key from the in-app Settings page instead — see INSTALLATION.md)
npm start
```

Then open **http://localhost:4173** in your browser. That's it — the server only
listens on `localhost`, so nothing outside your machine can reach it.

For full setup detail (including running a fully local/free model), see
[`INSTALLATION.md`](./INSTALLATION.md). For how to actually use the app day to day, see
[`USER_GUIDE.md`](./USER_GUIDE.md). For privacy/security specifics, see
[`PRIVACY.md`](./PRIVACY.md). For the code layout and how to extend it, see
[`DEVELOPMENT.md`](./DEVELOPMENT.md).

## Why this stack

- **Backend:** Node.js + Express. No database — just local JSON files under `data/`
  (git-ignored). Single process, single dependency tree, runs anywhere Node runs.
- **Frontend:** Plain HTML/CSS/JS, no build step, no framework. For a personal tool this
  keeps `npm install && npm start` as the entire setup — no Vite/webpack/React toolchain
  to maintain just to fix your Teams messages.
- **AI layer:** A small `AIProvider` interface (`server/providers/`) with OpenAI,
  Anthropic, and a generic OpenAI-compatible "Custom" provider (covers local models via
  Ollama/LM Studio, or any hosted OpenAI-compatible API). Swapping providers is a
  Settings-page change, not a code change.

This intentionally is **not** Electron/Tauri yet — see the roadmap below for why, and
when that's worth doing.

## Roadmap / what's next

This has grown past the original 7-phase brief into a real installable desktop app.
Where things actually stand:

1. ✅ **Copy/paste workflow** (the original MVP) — web UI, all rewrite modes, provider
   abstraction, protected terms, privacy controls.
2. ✅ **Browser extension** — see `browser-extension/EXTENSION_README.md`. Chrome/Edge,
   detects editable fields on any site (including Teams web and Zoho Desk, since those
   run in a browser tab), injects a "✨ WriteMate" affordance, calls this same local
   backend. Not yet built for Firefox specifically (Manifest V3 support differs slightly
   there — ask if you want that ported).
3. ✅ **Desktop app (Electron)** — the same frontend/backend wrapped in a native window,
   with a bundled global hotkey (Ctrl+Alt+W, via a bundled AutoHotkey interpreter — no
   separate install) and the browser extension bundled + a guided "load it" helper.
   Packaged as a real Windows installer (and a portable .zip) — see "Download" above.
   API keys are encrypted at rest via Windows' own credential vault when running as this
   packaged app.
4. ✅ **GitHub Releases pipeline** — tagging a version (`git tag vX.Y.Z && git push origin
   vX.Y.Z`) builds both download formats on a clean runner and publishes them to this
   repo's Releases page automatically (see `.github/workflows/release.yml`).
5. **Auto-update** — checking for and installing new versions from inside the app,
   instead of downloading a new release by hand each time.
6. **Microsoft Teams integration** — a Teams message-extension app calling this backend.
7. **Zoho Desk integration** — via Zoho's supported extension/API points, same backend.
8. Personal writing style (already partially in this MVP as an explicit, user-controlled
   list) — deepening it with example-based style extraction if wanted.
9. Optional shared backend for giving this to friends without everyone needing their own
   AI provider API key (see "Self-hosting modes" in `DEVELOPMENT.md`).

Ask for any of these when you're ready — each is designed to bolt onto this same
`ai-engine`/`server` core rather than replace it.
