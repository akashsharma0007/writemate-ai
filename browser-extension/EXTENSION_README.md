# WriteMate AI — Browser Extension (Phase 2)

This is the browser-extension phase from the roadmap: a small "✨" button that appears
next to whatever text field you're typing in, on any website, and opens a compact
version of WriteMate right there — no copy/pasting into the main app required.

It requires the main app (`writemate-ai/`) to be **running locally** (`npm start`) — the
extension is a thin client. It never talks to any AI provider directly; it always goes
through your local server, so all the same privacy/protected-terms/writing-style logic
from the main app applies here too.

## Install it (Chrome or Edge, "unpacked" — this isn't published to a store)

1. Make sure the main app is running: `npm start` in your `writemate-ai` folder, and
   confirm `http://localhost:4173` loads in a browser tab.
2. Open `chrome://extensions` (or `edge://extensions` in Edge).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select this `browser-extension` folder (the one with `manifest.json` in it).
6. You should see "WriteMate AI" appear in your extensions list, and an icon in your
   browser toolbar (a generic default icon — this build has no custom icon files).

That's it — no build step, no npm install for the extension itself.

## Using it

1. Click into any text box on any page — a Gmail compose window, a Teams message box,
   a Zoho Desk ticket reply, a plain `<textarea>`, anything.
2. A small ✨ badge appears near the top-right corner of that field.
3. Click it. A small panel opens with: **Fix Grammar**, **Rewrite**, **Professional**,
   **Concise**, **Friendly**, and **Custom instruction…**.
4. Pick one (or type a custom instruction and hit **Go**). If you'd selected some text
   inside the field first, only that selection is used — otherwise the whole field's
   content is sent.
5. The suggestion appears in the panel. Click **Replace** to swap it into the field in
   place, or **Copy** to copy it and paste manually. The result is *also* copied to your
   clipboard automatically the moment it's generated, as a safety net — so if in-place
   replace doesn't work on some particular site, you can always just paste.
6. **Try again** regenerates; the ✕ closes the panel.

Keyboard shortcut: **Ctrl/Cmd+Shift+W** opens the panel on whatever field currently has
focus (you can remap it at `chrome://extensions/shortcuts`).

The panel can be dragged by its header if it's covering something you need to see.

## Per-site control

Click the toolbar icon to open the popup. It shows:
- Whether the extension can currently reach your local WriteMate server (green/red dot).
- A toggle to **disable WriteMate on the current site** — it remembers this per
  hostname, so you can turn it off on sites where you don't want the badge showing up,
  without disabling the whole extension.
- An "Open full WriteMate app" button, for when you want the full UI (History,
  Templates, My Style, etc.) instead of the quick popup.

## Known limitations — please read before reporting something as "broken"

This is genuinely a hard problem in general (Grammarly itself has the same limitations),
so being upfront about where it's shaky:

- **Plain `<input>` and `<textarea>` fields** (most login-free web forms, many simple
  compose boxes) — Replace should work reliably here; it uses the same technique React
  itself uses internally, so React-controlled inputs pick up the change correctly.
- **Rich-text / `contenteditable` editors** — Teams, Zoho Desk's ticket editor, Gmail's
  compose box, and similar are usually a `contenteditable` `<div>` driven by a JS
  framework (Slate, Draft.js, Quill, or something custom). Replace uses
  `document.execCommand('insertText', ...)`, which is the most broadly-compatible way to
  simulate "the user typed this" for these editors — but `execCommand` is a deprecated
  browser API and a small number of heavily-customized editors may not accept it
  cleanly, or may only replace part of the field. **The result is always copied to your
  clipboard automatically as a fallback** — if Replace looks wrong, just undo it
  (Ctrl+Z in the field) and paste (Ctrl+V) instead.
- **iframes** — the extension does inject into iframes (`all_frames: true` in the
  manifest), which covers most embedded compose widgets, but a small number of sites
  isolate their editor in ways that block this.
- **Password fields, disabled/read-only fields** — intentionally skipped.
- **Native desktop apps** (the Teams *desktop* client specifically, not the Teams web
  app in a browser tab) — a browser extension fundamentally cannot reach these; that's
  what Phase 3 (a desktop floating assistant) and Phase 4 (a real Teams app) are for.

If something doesn't work right on a specific site you use a lot, tell me exactly what
happened (which site, which field, what you clicked) and I can usually special-case it.

## Changing the server port

If you changed `PORT` in the main app's `.env`, you need to update two places here:
1. `manifest.json` → `host_permissions` (change `4173` to your port in both entries).
2. The popup's "Backend URL" field (or just edit `chrome.storage.local`'s `backendUrl`
   via the popup UI — it has a field for this).

Then reload the extension from `chrome://extensions` (the reload icon on the WriteMate
AI card) for the manifest change to take effect.

## Privacy notes specific to the extension

- The badge/panel only appear after you focus an editable field — nothing is read or
  sent anywhere until you explicitly click an action button.
- The extension has no broad network permissions — only for content-script injection
  (so it can detect fields) and for `http://localhost:4173` (so it can reach your
  server). It cannot make network requests to the sites you're on, and it doesn't read
  or transmit anything about your browsing beyond the field text you actively send
  through an action button.
- See the main app's `PRIVACY.md` for what happens to your text after that point — it's
  the same server, the same rules.
