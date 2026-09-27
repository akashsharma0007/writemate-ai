# Installation

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (20+ recommended). Check with `node --version`.
- An API key from **one** of:
  - [OpenAI](https://platform.openai.com/api-keys) — works with `gpt-4o-mini` (cheap,
    default) or any chat-completions model.
  - [Anthropic](https://console.anthropic.com/settings/keys) — works with
    `claude-3-5-haiku-20241022` (cheap, default) or any Claude model.
  - Or nothing at all, if you run a local model (see "Free / local option" below).

## Steps

1. **Get the files onto your machine** (you already have them if you're reading this
   from the delivered project folder).

2. **Install dependencies:**

   ```bash
   cd writemate-ai
   npm install
   ```

3. **Configure your API key.** You have two options — pick whichever is more
   convenient. Both are equally secure (the key never leaves your machine except in
   direct calls to the provider you chose):

   **Option A — `.env` file (recommended for a single personal setup):**

   ```bash
   cp .env.example .env
   ```

   Open `.env` in a text editor and fill in, for example:

   ```
   WRITEMATE_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```

   or for Anthropic:

   ```
   WRITEMATE_PROVIDER=anthropic
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-3-5-haiku-20241022
   ```

   **Option B — the in-app Settings page.** Start the app (next step), open the
   **Settings** view, pick a provider, paste your key, and click **Save settings**. This
   writes to `data/settings.json` on your machine (git-ignored, never committed, never
   sent anywhere except to that provider's API when you click Generate).

   `.env` values are used as the fallback for anything you haven't set from the
   Settings page, so you can mix both if you like.

4. **Start the app:**

   While you're actively changing code (settings, prompts, bug fixes — anything under
   `server/`), use:

   ```bash
   npm run dev
   ```

   instead of `npm start`. It watches `server/` and `.env` and restarts itself the
   moment either changes, so you never have to manually stop and re-run it. Frontend
   files (`public/*.html/js/css`) need no restart at all either way — the server always
   reads those fresh from disk, so a browser refresh (F5) is enough. Reach for
   `npm start` only once things are stable and you just want it running quietly in the
   background.

   You should see:

   ```
     WriteMate AI is running: http://localhost:4173
   ```

5. **Open http://localhost:4173** in your browser. The server binds to `127.0.0.1`
   only — nothing else on your network can reach it.

## Free / local option (no API key, no per-request cost)

If you'd rather not use a paid API, you can point WriteMate at a local model server that
speaks the OpenAI-compatible chat-completions format — for example
[Ollama](https://ollama.com):

```bash
# in a separate terminal
ollama pull llama3.1
ollama serve   # usually already running after install
```

Then in WriteMate's Settings page, choose **Custom / Local**, and set:

- **Base URL:** `http://localhost:11434/v1`
- **Model:** `llama3.1` (or whatever you pulled)
- **API key:** leave blank

Quality will be lower than a frontier hosted model, especially for the "preserve exact
technical terms" guarantee — treat protected-term warnings extra seriously with a local
model, and consider a stronger local model if you have the hardware for it.

## Running it every time

`npm start` runs it in the foreground with no auto-restart — use it once you're done
making changes. `npm run dev` (see step 4 above) is the one to leave running while you're
actively developing, since it restarts itself on every change under `server/` or `.env`
(uses Node's built-in `--watch`, watching both paths explicitly).

- Keep a terminal tab open and leave it running, or use your OS's own tools (e.g. `pm2`,
  a systemd user service, or a Windows Task Scheduler entry / macOS LaunchAgent) if you
  want it to start automatically at login. That's outside the scope of this MVP but the
  app itself doesn't need anything special to run under any of those.

## Troubleshooting

- **"The provider isn't configured yet"** — you haven't set an API key for the provider
  currently selected in Settings. Add one (see step 3) or switch providers.
- **Port already in use** — change `PORT=4173` in `.env` to something else, e.g. `4174`.
- **Requests time out** — check `AI_REQUEST_TIMEOUT_MS` in `.env` (default 30s); a slow
  local model may need more.
- **A protected term warning keeps appearing for something that's fine** — that's the
  verification step doing its job; you can always edit the result before accepting. If a
  particular value shouldn't be flagged, it usually means the AI reworded it — check
  the diff view to confirm before accepting.
