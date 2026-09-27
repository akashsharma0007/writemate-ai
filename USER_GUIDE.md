# User Guide

## The Write view

1. Paste or type your text into **Original text**.
2. *(Optional)* Click **+ Add context** and describe what you're actually trying to say.
   This is the single biggest lever for quality — the example from the original brief:

   > Context: *"This is a response to a client. They are confused about a reporting
   > change introduced in GA13. I need to explain a temporary workaround without making
   > it sound like the system is broken."*
   >
   > Original: `you have to remove abandoned sales from gross sales plus taxes`
   >
   > Result: *"To calculate the amount that should be entered in Orbit, please deduct
   > the Abandoned Sales amount from Gross Sales plus Taxes."*

3. Pick a **Template** (optional) to prefill a tone/action for a recurring message type,
   a **Context profile** (Work/Internal/Personal/custom) to bias the audience, a
   **Tone**, and an **Action** (Fix Grammar, Improve, Professional, Concise, etc.).
4. Add a **Custom instruction** if you want something more specific ("sound professional
   but not robotic").
5. Click **Generate** (or press `Ctrl/Cmd + Enter`).

## Reading the result

- **Side-by-side** — original next to the rewritten version, with the detected tone
  shown as a badge.
- **Diff** — word-level view: <span style="background:#dcfce7">green</span> = added,
  <span style="background:#fee2e2;text-decoration:line-through">red strikethrough</span>
  = removed.
- **Grammar issues** *(only for the Fix Grammar action)* — each issue listed separately
  with **Accept** / **Ignore**, plus **Accept all**. The side-by-side "Improved" text
  updates live as you accept or ignore individual issues.
- **Warnings** — shown above the tabs when something needs your attention, most commonly
  a protected value (a ticket number, URL, dollar amount, or a term you added under
  Protected Terms) that didn't survive into the rewrite verbatim. Always check these
  before accepting.

## Acting on a result

- **Edit** — make the improved text directly editable before you accept it.
- **Copy** — copies the current improved/corrected text to your clipboard.
- **Try again** — regenerates with the same inputs (useful since results aren't
  identical every time).
- **Accept** — replaces the Original text box with the result, so you can keep refining
  it, or copy it out when you're happy.
- **Undo** — reverts the last Accept.

## My Writing Style

A plain list of preferences you write yourself — e.g. *"Don't overuse 'please'"*,
*"Avoid corporate buzzwords"*, *"Keep sentences short."* These are included on every
request (toggle **Apply my writing style** off on the Write view to skip them for one
request). Nothing is inferred from your usage — you're always in full control of what's
in this list, and you can edit or delete any line at any time.

## Context Profiles

Work / Internal / Personal ship as built-in presets. Add your own (e.g. "Vendors",
"Leadership") with a short description of how writing to that audience should sound;
select one from the Write view to bias tone and framing.

## Templates

A template just prefills a default tone/action (and optionally default context) for a
recurring message type — Client Email, Ticket Response, Escalation, etc. Add your own
from the Templates page.

## Protected Terms

Two layers:

1. **Always protected automatically**, no setup needed: URLs, email addresses, dollar
   amounts, dates, version numbers, ticket/case-style IDs, code spans (`` `like this` ``),
   and any 2+ digit number.
2. **Your own list**, on the Protected Terms page — add anything specific to your work
   (`GA13`, `Orbit`, `CDB_CUSTOMER_INFO`, a customer's name, an internal tool name...).

Every request extracts everything matching these two categories from your original
text, tells the AI explicitly to preserve them, and then double-checks the result
afterward. If something's missing, you get a warning — never a silent change.

## History

Off by default. Turn it on from **Settings** (you also need to turn off "Do not save my
text" — privacy mode intentionally overrides the history toggle). When on, every
generate call is recorded locally (date, action, tone, context, original, result) so you
can find it again later. Delete individual entries or everything from the History page
at any time.

## Settings

- **Privacy** — "Do not save my text" is on by default; turning it off is required
  before history can record anything.
- **AI Provider** — OpenAI, Anthropic, or Custom/Local, with per-provider API key, model,
  and (for Custom) base URL.
- **Temperature** — lower is more consistent/conservative, higher is more varied.
- **Max output tokens** — a hard cap on how long a single result can be (also a cost
  control).

## Keyboard shortcuts

- `Ctrl/Cmd + Enter` — Generate
- `Esc` — un-focus the current field (e.g. to stop editing a result)
