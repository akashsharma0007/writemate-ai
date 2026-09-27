# WriteMate Hotkey Bridge

The browser extension's ✨ widget only works inside browser tabs — a browser
can't reach outside itself into the Teams *desktop* client, Outlook, Notepad,
or any other native Windows app. This is the workaround: a single script that
gives you the same "select text, get WriteMate" experience **everywhere on
Windows**, via a keyboard shortcut instead of a floating button.

It does not require Electron, a new app install, or any change to how you run
WriteMate today — it's one script that talks to the WriteMate server you
already have running.

## What it does

1. You select some text in any Windows app — Teams desktop, Outlook, a native
   app, anywhere.
2. You press **Ctrl+Alt+W**.
3. A small WriteMate popup appears showing the text it grabbed, with an
   optional context box and the same actions as the browser extension: Fix
   Grammar, Rewrite, Professional, Concise, Friendly, Custom.
4. You pick an action. It sends the text to your local WriteMate server (the
   same one the web app and browser extension use) and shows the result.
5. **Copy** puts the result on your clipboard, or **Replace** pastes it
   directly back over the text you originally selected.

Nothing here talks to the internet except your own WriteMate server at
`http://127.0.0.1:4173` on your own machine — same privacy model as the rest
of WriteMate. Whatever AI provider you've configured in Settings is still the
only thing that ever sees your text.

## Requirements

- **AutoHotkey v2.0 or later** — free, from <https://www.autohotkey.com/>.
  Download "AutoHotkey v2" (not v1.1) and run the installer.
- The WriteMate server running locally. From the `writemate-ai` folder:
  ```
  npm run dev
  ```
  (See `../../INSTALLATION.md` if you haven't set this up yet.) The hotkey
  bridge talks to whatever port your server is on — 4173 by default.

## Running it

Double-click `WriteMate-Hotkey.ahk`. If AutoHotkey v2 is installed, this runs
the script and puts a small "H" tray icon in your system tray (bottom-right,
may be under the "^" overflow arrow) — that means it's active and listening
for the hotkey in the background. You can close the popup window after use;
the script keeps running in the tray until you exit it (right-click the tray
icon → Exit).

## Using it

1. Select text anywhere — a Teams message box, an email, a document.
2. Press **Ctrl+Alt+W**.
3. If nothing was selected, you'll see a brief notification and nothing else
   happens — select some text and try again.
4. In the popup: optionally add context in the second box (e.g. "this is a
   reply to a frustrated customer"), then click an action button.
5. Review the result. **Copy** it, or click **Replace** to paste it directly
   back where you copied it from. **Close** dismisses the popup without
   changing anything.

## Changing the hotkey

Near the top of `WriteMate-Hotkey.ahk`:

```
HOTKEY_STRING := "^!w"        ; Ctrl+Alt+W
```

AutoHotkey's hotkey symbols: `^` = Ctrl, `!` = Alt, `+` = Shift, `#` = Win.
For example, Ctrl+Shift+G would be `"^+g"`. After changing it, right-click the
tray icon → **Reload This Script** (or just re-run the file).

If pressing the hotkey does nothing at all, another program may already be
using that combination — pick a different one.

## Running it automatically at Windows startup (optional)

1. Press **Win+R**, type `shell:startup`, press Enter — this opens your
   Startup folder.
2. Right-click inside it → **New → Shortcut**, and point it at
   `WriteMate-Hotkey.ahk` in this folder.

Now it starts automatically whenever you log in to Windows. (It will still
show connection errors if the WriteMate server itself isn't running — the
script and the server are two separate things you both need running.)

## Troubleshooting

**"Couldn't reach the WriteMate server..."** — Make sure `npm run dev` (or
`npm start`) is running in a terminal, in the `writemate-ai` folder, and that
you haven't changed the port away from 4173 in `.env` / Settings. If you did
change the port, update `SERVER_URL` near the top of the script to match.

**Nothing happens when I press the hotkey** — Confirm the tray icon is
present (the script is actually running). If it is, something else on your
system is probably already bound to that key combination — change
`HOTKEY_STRING` as above.

**The popup shows the wrong text, or empty text** — Some apps handle Ctrl+C
in unusual ways. Make sure the text is actually selected (highlighted) before
pressing the hotkey, not just that your cursor is nearby.

**Replace pastes into the wrong window** — This can happen if you switch
windows while the WriteMate popup is open before clicking Replace. Use
**Copy** instead and paste manually with Ctrl+V in that case.

## A note on how this was verified

This script was written and reviewed carefully against documented AutoHotkey
v2 syntax, but — unlike the rest of WriteMate — it couldn't be executed
end-to-end from the environment that built it (that environment can reach
your files, but can't run Windows-only programs like AutoHotkey itself). If
the very first run throws an AutoHotkey syntax/runtime error, please copy the
exact error text (AutoHotkey errors always name a line number) back so it can
be fixed precisely — that's a much faster fix than guessing.
