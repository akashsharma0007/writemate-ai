const DEFAULT_BACKEND_URL = 'http://localhost:4173';

function $(sel) { return document.querySelector(sel); }

async function currentHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return null;
  try {
    return new URL(tab.url).hostname;
  } catch {
    return null;
  }
}

async function init() {
  const { backendUrl, disabledSites } = await chrome.storage.local.get(['backendUrl', 'disabledSites']);
  $('#backendUrlInput').value = backendUrl || DEFAULT_BACKEND_URL;

  const hostname = await currentHostname();
  if (hostname) {
    $('#siteHost').textContent = hostname;
    $('#siteToggle').checked = !(disabledSites || []).includes(hostname);
  } else {
    $('#siteHost').textContent = 'this page';
    $('#siteToggle').disabled = true;
  }

  checkStatus();

  $('#siteToggle').addEventListener('change', async (e) => {
    if (!hostname) return;
    const { disabledSites: current } = await chrome.storage.local.get('disabledSites');
    let list = current || [];
    if (e.target.checked) {
      list = list.filter((h) => h !== hostname);
    } else if (!list.includes(hostname)) {
      list = [...list, hostname];
    }
    await chrome.storage.local.set({ disabledSites: list });
  });

  $('#saveBackendBtn').addEventListener('click', async () => {
    const url = $('#backendUrlInput').value.trim() || DEFAULT_BACKEND_URL;
    await chrome.storage.local.set({ backendUrl: url });
    checkStatus();
  });

  $('#openAppBtn').addEventListener('click', async () => {
    const { backendUrl: url } = await chrome.storage.local.get('backendUrl');
    chrome.tabs.create({ url: url || DEFAULT_BACKEND_URL });
  });
}

function checkStatus() {
  const dot = $('#statusDot');
  const text = $('#statusText');
  const hint = $('#statusHint');
  dot.className = 'dot';
  text.textContent = 'Checking…';
  hint.textContent = '';

  chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.ok) {
      dot.className = 'dot bad';
      text.textContent = 'Not reachable';
      hint.textContent = 'Start the WriteMate server on your machine (npm start in the writemate-ai folder), then reopen this popup.';
      return;
    }
    dot.className = 'dot ok';
    text.textContent = 'Connected';
  });
}

init();
