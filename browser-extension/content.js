// WriteMate AI — content script.
//
// Detects focus on any editable field on the page, shows a small "✨"
// badge next to it, and opens a compact action panel on click. All actual
// AI calls go through the background service worker (see background.js
// for why). Everything we inject lives inside a single shadow root so we
// never leak CSS into the host page, and the host page's CSS never leaks
// into us — important since Teams/Zoho/etc. all have their own complex
// stylesheets.

(function () {
  if (window.__writemateInjected) return;
  window.__writemateInjected = true;

  const ACTIONS = [
    { id: 'fix_grammar', label: 'Fix Grammar' },
    { id: 'improve', label: 'Rewrite' },
    { id: 'professional', label: 'Professional' },
    { id: 'concise', label: 'Concise' },
    { id: 'friendly', label: 'Friendly' },
  ];

  const state = {
    enabled: true,
    activeField: null,
    hostEl: null,
    shadow: null,
    badge: null,
    panel: null,
    panelOpen: false,
    lastResultText: null,
    lastScope: null,
    lastActionId: null,
    lastCustomInstruction: null,
    dragging: false,
  };

  // ---------------------------------------------------------- site toggle

  chrome.storage.local.get(['disabledSites']).then(({ disabledSites }) => {
    state.enabled = !(disabledSites || []).includes(location.hostname);
    if (state.enabled) attach();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.disabledSites) return;
    const nowDisabled = (changes.disabledSites.newValue || []).includes(location.hostname);
    if (nowDisabled && state.enabled) {
      state.enabled = false;
      detach();
    } else if (!nowDisabled && !state.enabled) {
      state.enabled = true;
      attach();
    }
  });

  // -------------------------------------------------------------- helpers

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.disabled || el.readOnly) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email', 'url', 'tel', ''].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function getFieldText(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (typeof start === 'number' && typeof end === 'number' && start !== end) {
        return { text: el.value.slice(start, end), isSelection: true, start, end };
      }
      return { text: el.value, isSelection: false };
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        return { text: sel.toString(), isSelection: true, range: range.cloneRange() };
      }
    }
    return { text: el.innerText || el.textContent || '', isSelection: false };
  }

  function replaceFieldText(el, newText, scope) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      let newValue, cursor;
      if (scope.isSelection) {
        newValue = el.value.slice(0, scope.start) + newText + el.value.slice(scope.end);
        cursor = scope.start + newText.length;
      } else {
        newValue = newText;
        cursor = newValue.length;
      }
      setter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        el.setSelectionRange(cursor, cursor);
      } catch {
        /* some input types don't support selection ranges */
      }
      return true;
    }

    // contenteditable — use execCommand so rich-text frameworks (which
    // usually listen for native beforeinput/input events) pick up the
    // change the same way they would a real keystroke or paste.
    try {
      el.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      if (scope.isSelection && scope.range) {
        sel.addRange(scope.range);
      } else {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.addRange(range);
      }
      const ok = document.execCommand('insertText', false, newText);
      if (!ok) throw new Error('execCommand unsupported');
      return true;
    } catch {
      return false; // caller falls back to "copied to clipboard, paste manually"
    }
  }

  // ------------------------------------------------------------- shadow UI

  function buildUi() {
    const hostEl = document.createElement('div');
    hostEl.id = 'writemate-extension-root';
    hostEl.style.all = 'initial';
    (document.body || document.documentElement).appendChild(hostEl);
    const shadow = hostEl.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadow.appendChild(link);

    const badge = document.createElement('button');
    badge.className = 'wm-badge';
    badge.type = 'button';
    badge.title = 'WriteMate — click for suggestions';
    badge.textContent = '✨';
    badge.hidden = true;
    shadow.appendChild(badge);

    const panel = document.createElement('div');
    panel.className = 'wm-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="wm-panel-header" id="wm-drag-handle">
        <span class="wm-panel-title">✨ WriteMate</span>
        <button class="wm-panel-close" type="button" title="Close">✕</button>
      </div>
      <div class="wm-panel-body">
        <div class="wm-scope-note" id="wm-scope-note"></div>
        <div class="wm-action-grid" id="wm-action-grid"></div>
        <div class="wm-custom-row" id="wm-custom-row" hidden>
          <input type="text" id="wm-custom-input" placeholder="e.g. sound professional but not robotic" />
          <button class="wm-btn wm-btn-primary" id="wm-custom-go" type="button">Go</button>
        </div>
        <div class="wm-status" id="wm-status" hidden></div>
        <div class="wm-result" id="wm-result" hidden>
          <div class="wm-warning" id="wm-warning" hidden></div>
          <div class="wm-result-label">Suggestion</div>
          <div class="wm-result-text" id="wm-result-text"></div>
          <div class="wm-result-actions">
            <button class="wm-btn wm-btn-primary" id="wm-replace-btn" type="button">Replace</button>
            <button class="wm-btn" id="wm-copy-btn" type="button">Copy</button>
            <button class="wm-btn wm-btn-ghost" id="wm-again-btn" type="button">Try again</button>
          </div>
        </div>
      </div>
    `;
    shadow.appendChild(panel);

    const grid = panel.querySelector('#wm-action-grid');
    ACTIONS.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'wm-btn';
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', () => runAction(action.id));
      grid.appendChild(btn);
    });
    const customBtn = document.createElement('button');
    customBtn.className = 'wm-btn wm-btn-full';
    customBtn.type = 'button';
    customBtn.textContent = 'Custom instruction…';
    customBtn.addEventListener('click', () => {
      const row = panel.querySelector('#wm-custom-row');
      row.hidden = !row.hidden;
      if (!row.hidden) panel.querySelector('#wm-custom-input').focus();
    });
    grid.appendChild(customBtn);

    panel.querySelector('.wm-panel-close').addEventListener('click', closePanel);
    panel.querySelector('#wm-copy-btn').addEventListener('click', copyResult);
    panel.querySelector('#wm-replace-btn').addEventListener('click', applyReplace);
    panel.querySelector('#wm-again-btn').addEventListener('click', () => {
      if (state.lastActionId) runAction(state.lastActionId, state.lastCustomInstruction);
    });
    panel.querySelector('#wm-custom-go').addEventListener('click', () => {
      const val = panel.querySelector('#wm-custom-input').value.trim();
      if (val) runAction('custom', val);
    });
    panel.querySelector('#wm-custom-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') panel.querySelector('#wm-custom-go').click();
    });

    badge.addEventListener('click', openPanel);
    makeDraggable(panel, panel.querySelector('#wm-drag-handle'));

    state.hostEl = hostEl;
    state.shadow = shadow;
    state.badge = badge;
    state.panel = panel;
  }

  function makeDraggable(panel, handle) {
    let offsetX = 0;
    let offsetY = 0;

    function onMove(e) {
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
    }
    function onUp() {
      state.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    handle.addEventListener('mousedown', (e) => {
      state.dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ------------------------------------------------------------ badge/panel

  function clampToViewport(left, top, width, height) {
    const margin = 6;
    const maxLeft = window.innerWidth - width - margin;
    const maxTop = window.innerHeight - height - margin;
    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, maxLeft)),
      top: Math.min(Math.max(margin, top), Math.max(margin, maxTop)),
    };
  }

  function positionBadge() {
    if (!state.activeField || !state.badge) return;
    const rect = state.activeField.getBoundingClientRect();
    const { left, top } = clampToViewport(rect.right - 26, rect.top - 10, 30, 30);
    state.badge.style.left = `${left}px`;
    state.badge.style.top = `${top}px`;
  }

  function showBadge() {
    if (!state.badge) return;
    state.badge.hidden = false;
    positionBadge();
  }

  function hideBadge() {
    if (state.badge) state.badge.hidden = true;
  }

  function openPanel() {
    if (!state.activeField || !state.panel) return;
    const scope = getFieldText(state.activeField);
    state.panel.querySelector('#wm-scope-note').textContent = scope.isSelection
      ? 'Using your current selection.'
      : 'Using the whole field (select text first to limit the scope).';
    resetResultUi();
    const rect = state.badge.getBoundingClientRect();
    const { left, top } = clampToViewport(rect.left - 270, rect.bottom + 8, 300, 260);
    state.panel.style.left = `${left}px`;
    state.panel.style.top = `${top}px`;
    state.panel.hidden = false;
    state.panelOpen = true;
    hideBadge();
  }

  function closePanel() {
    if (state.panel) state.panel.hidden = true;
    state.panelOpen = false;
    if (state.activeField) showBadge();
  }

  function resetResultUi() {
    const panel = state.panel;
    panel.querySelector('#wm-status').hidden = true;
    panel.querySelector('#wm-result').hidden = true;
    panel.querySelector('#wm-warning').hidden = true;
    panel.querySelector('#wm-custom-row').hidden = true;
  }

  function showStatus(text, isError) {
    const el = state.panel.querySelector('#wm-status');
    el.hidden = false;
    el.classList.toggle('wm-error', Boolean(isError));
    el.innerHTML = isError ? text : `<span class="wm-spinner"></span>${text}`;
  }

  // Finds a non-overlapping span for each issue's `suggestion` fragment
  // inside the (already-corrected) result text, so the words Fix Grammar
  // actually changed can be underlined — mirrors the same non-overlap logic
  // the main app uses in public/app.js, kept as a separate small copy here
  // since this project has no build step / shared-module bundling between
  // the extension and the web app.
  function computeHighlightRanges(text, issues) {
    const claimed = [];
    const ranges = [];
    (issues || []).forEach((issue) => {
      const frag = issue.suggestion;
      if (!frag) return;
      let searchFrom = 0;
      let start = -1;
      for (;;) {
        const pos = text.indexOf(frag, searchFrom);
        if (pos === -1) break;
        const end = pos + frag.length;
        const overlaps = claimed.some((r) => pos < r.end && end > r.start);
        if (!overlaps) {
          start = pos;
          break;
        }
        searchFrom = pos + 1;
      }
      if (start === -1) return;
      const end = start + frag.length;
      claimed.push({ start, end });
      ranges.push({ start, end, original: issue.original });
    });
    ranges.sort((a, b) => a.start - b.start);
    return ranges;
  }

  // Renders `text` into `container`, wrapping each recovered highlight range
  // in a span with a wavy underline (hover shows what it was before the
  // fix). Falls back to plain text when there are no issues to highlight
  // (rewrite modes, or grammar text with nothing flagged).
  function renderHighlightedText(container, text, issues) {
    container.innerHTML = '';
    const ranges = issues && issues.length ? computeHighlightRanges(text, issues) : [];
    if (ranges.length === 0) {
      container.textContent = text;
      return;
    }
    let cursor = 0;
    ranges.forEach((r) => {
      if (r.start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, r.start)));
      const span = document.createElement('span');
      span.className = 'wm-issue-highlight';
      span.textContent = text.slice(r.start, r.end);
      if (r.original) span.title = `Was: "${r.original}"`;
      container.appendChild(span);
      cursor = r.end;
    });
    if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function showResult(text, warnings, issues) {
    const panel = state.panel;
    panel.querySelector('#wm-status').hidden = true;
    panel.querySelector('#wm-result').hidden = false;
    renderHighlightedText(panel.querySelector('#wm-result-text'), text, issues);
    const warningEl = panel.querySelector('#wm-warning');
    if (warnings && warnings.length > 0) {
      warningEl.hidden = false;
      warningEl.textContent = `⚠ ${warnings.join(' ')}`;
    } else {
      warningEl.hidden = true;
    }
  }

  function runAction(actionId, customInstruction) {
    if (!state.activeField) return;
    const scope = getFieldText(state.activeField);
    if (!scope.text || !scope.text.trim()) {
      showStatus('Nothing to rewrite — type or select some text first.', true);
      return;
    }
    state.lastActionId = actionId;
    state.lastCustomInstruction = customInstruction;
    state.lastScope = scope;
    resetResultUi();
    showStatus('Generating…');

    chrome.runtime.sendMessage(
      {
        type: 'rewrite',
        payload: {
          text: scope.text,
          action: actionId,
          customInstruction,
          applyWritingStyle: true,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showStatus(`Extension error: ${chrome.runtime.lastError.message}`, true);
          return;
        }
        if (!response || !response.ok) {
          showStatus(
            response?.error ||
              'WriteMate server not reachable — make sure it is running at localhost:4173.',
            true
          );
          return;
        }
        const data = response.data;
        const isGrammar = actionId === 'fix_grammar';
        const resultText = isGrammar ? data.correctedText : data.improvedText;
        state.lastResultText = resultText;
        showResult(resultText, data.warnings, isGrammar ? data.issues : null);
        navigator.clipboard.writeText(resultText).catch(() => {});
      }
    );
  }

  function copyResult() {
    if (!state.lastResultText) return;
    navigator.clipboard.writeText(state.lastResultText).then(() => flash('#wm-copy-btn', 'Copied!'));
  }

  function applyReplace() {
    if (!state.lastResultText || !state.activeField) return;
    const ok = replaceFieldText(state.activeField, state.lastResultText, state.lastScope);
    flash('#wm-replace-btn', ok ? 'Replaced ✓' : 'Copied — paste manually');
    if (!ok) navigator.clipboard.writeText(state.lastResultText).catch(() => {});
  }

  function flash(selector, label) {
    const btn = state.panel.querySelector(selector);
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => {
      btn.textContent = original;
    }, 1400);
  }

  // ---------------------------------------------------------------- events

  function onFocusIn(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    if (state.hostEl && path.includes(state.hostEl)) return; // focus moved into our own widget
    const target = path[0];
    if (isEditable(target)) {
      state.activeField = target;
      if (!state.panelOpen) showBadge();
    } else {
      state.activeField = null;
      hideBadge();
      closePanel();
    }
  }

  function onScrollOrResize() {
    if (state.activeField && !state.panelOpen) positionBadge();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && state.panelOpen) closePanel();
  }

  function onRuntimeMessage(message) {
    if (message.type === 'toggle-panel') {
      if (state.panelOpen) closePanel();
      else if (state.activeField) openPanel();
    }
  }

  let attached = false;
  function attach() {
    if (attached) return;
    attached = true;
    if (!state.hostEl) buildUi();
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', onKeyDown, true);
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }

  function detach() {
    if (!attached) return;
    attached = false;
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
    document.removeEventListener('keydown', onKeyDown, true);
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    state.activeField = null;
    hideBadge();
    closePanel();
  }
})();
