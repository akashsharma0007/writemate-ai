// WriteMate AI — background service worker.
//
// Why this exists as a separate script instead of fetching straight from
// content.js: content scripts run "as" the page, so their fetches are
// subject to that page's CORS and mixed-content / Private Network Access
// rules — an https:// site (Teams, Zoho Desk, etc.) reaching out to a
// plain http://localhost server is exactly the kind of request modern
// Chrome increasingly blocks from page context. A background service
// worker runs as the *extension*, not the page, so a request to a host
// listed in manifest.json's host_permissions goes through cleanly. So:
// content.js never calls the backend directly — it always asks the
// background worker to do it via chrome.runtime.sendMessage.

const DEFAULT_BACKEND_URL = 'http://localhost:4173';

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(['backendUrl', 'disabledSites']);
  if (!stored.backendUrl) {
    await chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
  if (!stored.disabledSites) {
    await chrome.storage.local.set({ disabledSites: [] });
  }
});

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.local.get('backendUrl');
  return (backendUrl || DEFAULT_BACKEND_URL).replace(/\/$/, '');
}

async function callBackend(path, options = {}) {
  const base = await getBackendUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `WriteMate server error (${res.status})`);
  }
  return body;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'ping') {
        const meta = await callBackend('/api/meta');
        sendResponse({ ok: true, meta });
        return;
      }
      if (message.type === 'rewrite') {
        const data = await callBackend('/api/rewrite', {
          method: 'POST',
          body: JSON.stringify(message.payload),
        });
        sendResponse({ ok: true, data });
        return;
      }
      sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; // keep the message channel open for the async response
});

// Ctrl/Cmd+Shift+W — brief section 17's global shortcut. We can't truly
// invoke this outside the browser (that's the Phase 3 desktop assistant),
// but inside any tab we forward it to the content script so it opens the
// widget on whatever field currently has focus.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-widget') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {
      /* content script may not be injected on this page (e.g. chrome:// pages) */
    });
  }
});
