// WriteMate AI — frontend logic. Plain JS, no build step, no framework.
// Talks only to the local backend on the same origin (server/index.js).

const state = {
  meta: { tones: [], actions: [], providers: [] },
  settings: null,
  templates: [],
  profiles: [],
  lastRequestParams: null, // for "Try again"
  lastResult: null,
  grammarIssues: [], // [{ ...issue, status: 'pending'|'accepted'|'ignored' }]
  undoStack: [], // previous values of originalText, for "Undo" after Accept
};

// ---------------------------------------------------------------- helpers

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    // code + errorId (see server/lib/errorCodes.js / errorLog.js) — shown
    // to the person alongside the friendly message so it can be quoted back
    // to whoever maintains this install, and looked up via
    // GET /api/debug/errors/:id in Postman.
    err.code = body.code;
    err.errorId = body.errorId;
    throw err;
  }
  return body;
}

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function showError(message, { code, errorId } = {}) {
  // The warning box lives inside #resultPanel, which is hidden until the
  // first successful generate — reveal it here too, or an error before
  // that point would be written invisibly into a display:none container.
  $('#resultPanel').classList.remove('hidden');
  const box = $('#warningsBox');
  const ref = code ? ` (code ${code}${errorId ? ` · ref ${errorId}` : ''})` : '';
  box.textContent = `⚠ ${message}${ref}`;
  box.classList.remove('hidden');
}

// ------------------------------------------------------------- navigation

$all('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  $all('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $all('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'history') loadHistory();
  if (view === 'templates') loadTemplates();
  if (view === 'style') loadStyle();
  if (view === 'profiles') loadProfiles();
  if (view === 'terms') loadTerms();
  if (view === 'extension') loadExtensionView();
  if (view === 'settings') loadSettingsIntoForm();
}

// ------------------------------------------------------------------- init

async function init() {
  try {
    state.meta = await api('/meta');
  } catch (err) {
    showError(`Could not reach the WriteMate server: ${err.message}`);
    return;
  }
  populateToneAndActionSelects();
  await Promise.all([loadTemplatesIntoSelect(), loadProfilesIntoSelect(), loadSettings()]);
  bindWriteView();
  bindSettingsView();
  bindStyleView();
  bindProfilesView();
  bindTermsView();
  bindTemplatesView();
  bindHistoryView();
  bindExtensionView();
}

function populateToneAndActionSelects() {
  const toneSelect = $('#toneSelect');
  state.meta.tones.forEach((t) => toneSelect.appendChild(el('option', { value: t, text: t })));

  const fillActions = (selectEl) => {
    state.meta.actions.forEach((a) => selectEl.appendChild(el('option', { value: a.id, text: a.label })));
  };
  fillActions($('#actionSelect'));
  fillActions($('#newTemplateAction'));

  state.meta.tones.forEach((t) => $('#newTemplateTone').appendChild(el('option', { value: t, text: t })));
}

// --------------------------------------------------------------- WRITE view

function bindWriteView() {
  $('#toggleContext').addEventListener('click', () => {
    const wrap = $('#contextWrap');
    const hiding = !wrap.classList.contains('hidden');
    wrap.classList.toggle('hidden');
    $('#toggleContext').textContent = hiding ? '+ Add context (optional)' : '− Hide context';
  });

  $('#templateSelect').addEventListener('change', (e) => {
    const t = state.templates.find((tpl) => tpl.id === e.target.value);
    if (!t) return;
    if (t.defaultTone) $('#toneSelect').value = t.defaultTone;
    if (t.defaultAction) $('#actionSelect').value = t.defaultAction;
    if (t.defaultContext) {
      $('#contextText').value = t.defaultContext;
      $('#contextWrap').classList.remove('hidden');
      $('#toggleContext').textContent = '− Hide context';
    }
  });

  $('#generateBtn').addEventListener('click', generate);
  $('#clearBtn').addEventListener('click', clearCurrentText);

  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
    if (e.key === 'Escape') {
      document.activeElement && document.activeElement.blur();
    }
  });

  $all('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $all('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      $all('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
    });
  });

  $('#editBtn').addEventListener('click', toggleEdit);
  $('#copyBtn').addEventListener('click', copyResult);
  $('#tryAgainBtn').addEventListener('click', generate);
  $('#acceptBtn').addEventListener('click', acceptResult);
  $('#undoBtn').addEventListener('click', undoAccept);
  $('#acceptAllBtn').addEventListener('click', acceptAllGrammarIssues);
}

function clearCurrentText() {
  $('#originalText').value = '';
  $('#contextText').value = '';
  $('#customInstruction').value = '';
  $('#resultPanel').classList.add('hidden');
  state.lastResult = null;
  state.undoStack = [];
  $('#undoBtn').disabled = true;
}

async function generate() {
  const text = $('#originalText').value.trim();
  if (!text) {
    showError('Type or paste some text first.');
    return;
  }
  const action = $('#actionSelect').value;
  const params = {
    text,
    context: $('#contextText').value.trim(),
    tone: $('#toneSelect').value || undefined,
    action,
    customInstruction: $('#customInstruction').value.trim() || undefined,
    profileId: $('#profileSelect').value || undefined,
    templateId: $('#templateSelect').value || undefined,
    applyWritingStyle: $('#applyStyle').checked,
  };
  state.lastRequestParams = params;

  const btn = $('#generateBtn');
  const originalLabel = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  $('#warningsBox').classList.add('hidden');

  try {
    const data = await api('/rewrite', { method: 'POST', body: JSON.stringify(params) });
    state.lastResult = data;
    renderResult(data, action);
  } catch (err) {
    showError(err.message, { code: err.code, errorId: err.errorId });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

function renderResult(data, action) {
  $('#resultPanel').classList.remove('hidden');
  const isGrammar = action === 'fix_grammar';
  const resultText = isGrammar ? data.correctedText : data.improvedText;

  // Grammar mode renders the original box with inline highlights (see
  // renderOriginalWithHighlights) instead of plain text, so it's set further
  // down once state.grammarIssues exists. Rewrite modes have no per-issue
  // list to highlight against, so plain text is correct here.
  if (!isGrammar) $('#sideOriginal').textContent = data.originalText;
  $('#sideImproved').textContent = resultText;
  $('#sideImproved').setAttribute('contenteditable', 'false');
  $('#editBtn').textContent = 'Edit';

  const toneBadge = $('#detectedTone');
  if (data.detectedTone) {
    toneBadge.textContent = data.detectedTone;
    toneBadge.classList.remove('hidden');
  } else {
    toneBadge.classList.add('hidden');
  }

  if (data.warnings && data.warnings.length > 0) {
    $('#warningsBox').innerHTML = '';
    $('#warningsBox').appendChild(el('div', { text: '⚠ Please review:' }));
    data.warnings.forEach((w) => $('#warningsBox').appendChild(el('div', { text: `• ${w}` })));
    $('#warningsBox').classList.remove('hidden');
  } else {
    $('#warningsBox').classList.add('hidden');
  }

  renderDiff(data.diff || []);

  $('#grammarTab').style.display = isGrammar ? '' : 'none';
  if (isGrammar) {
    state.grammarIssues = (data.issues || []).map((iss) => ({ ...iss, status: 'pending' }));
    renderGrammarIssues();
    renderOriginalWithHighlights();
  }
}

// Finds a non-overlapping span in `text` for each issue's `original`
// fragment, so every flagged word/phrase can be wrapped in its own
// highlight — without two issues ever claiming the same characters (e.g. a
// "repeated-word" issue and a "capitalization" issue that both mention the
// same word). Issues whose fragment can't be found at all (the model didn't
// reproduce it exactly) are silently skipped here — they still show up in
// the issues list below, just without an inline highlight.
function computeHighlightRanges(text, issues) {
  const claimed = [];
  const ranges = [];
  issues.forEach((issue, idx) => {
    if (issue.status === 'ignored') return; // dismissed — no highlight
    const frag = issue.original;
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
    ranges.push({ start, end, idx, status: issue.status });
  });
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

// Renders #sideOriginal as the original text with each still-relevant issue
// wrapped in a highlighted span (wavy underline, like a spellchecker) —
// hovering shows the suggested fix, clicking jumps to that issue's card in
// the list below. Re-run after every Accept/Ignore so a resolved issue's
// highlight updates (accepted -> struck through, ignored -> removed).
function renderOriginalWithHighlights() {
  if (!state.lastResult) return;
  const container = $('#sideOriginal');
  container.innerHTML = '';
  const text = state.lastResult.originalText;
  const ranges = computeHighlightRanges(text, state.grammarIssues);

  let cursor = 0;
  ranges.forEach((r) => {
    if (r.start > cursor) container.appendChild(document.createTextNode(text.slice(cursor, r.start)));
    const issue = state.grammarIssues[r.idx];
    const span = el('span', {
      class: `issue-highlight issue-highlight-${r.status}`,
      text: text.slice(r.start, r.end),
      title: issue.suggestion ? `Suggestion: ${issue.suggestion}` : '',
      onclick: () => focusIssueCard(r.idx),
    });
    container.appendChild(span);
    cursor = r.end;
  });
  if (cursor < text.length) container.appendChild(document.createTextNode(text.slice(cursor)));
}

function focusIssueCard(idx) {
  const card = $(`#grammarIssues .grammar-issue[data-idx="${idx}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 900);
}

function renderDiff(diff) {
  const container = $('#diffView');
  container.innerHTML = '';
  diff.forEach((part) => {
    if (part.added) container.appendChild(el('span', { class: 'diff-added', text: part.value }));
    else if (part.removed) container.appendChild(el('span', { class: 'diff-removed', text: part.value }));
    else container.appendChild(document.createTextNode(part.value));
  });
}

function renderGrammarIssues() {
  const list = $('#grammarIssues');
  list.innerHTML = '';
  const pending = state.grammarIssues.filter((i) => i.status === 'pending').length;
  $('#grammarSummary').textContent = state.grammarIssues.length
    ? `${state.grammarIssues.length} issue(s) found — ${pending} pending`
    : 'No issues found.';

  state.grammarIssues.forEach((issue, idx) => {
    const card = el('div', { class: `grammar-issue ${issue.status !== 'pending' ? 'resolved' : ''}`, 'data-idx': idx }, [
      el('div', { class: 'issue-type', text: issue.type || 'issue' }),
      el('div', { class: 'issue-text' }, [
        el('span', { class: 'issue-original', text: issue.original || '' }),
        document.createTextNode('  →  '),
        el('span', { class: 'issue-suggestion', text: issue.suggestion || '' }),
      ]),
      issue.explanation ? el('div', { class: 'issue-explanation', text: issue.explanation }) : null,
      el('div', { class: 'grammar-issue-actions' }, [
        el('button', {
          class: 'btn btn-sm btn-primary',
          text: issue.status === 'accepted' ? 'Accepted ✓' : 'Accept',
          onclick: () => setIssueStatus(idx, 'accepted'),
        }),
        el('button', {
          class: 'btn btn-sm btn-ghost',
          text: issue.status === 'ignored' ? 'Ignored' : 'Ignore',
          onclick: () => setIssueStatus(idx, 'ignored'),
        }),
      ]),
    ]);
    list.appendChild(card);
  });
}

function setIssueStatus(idx, status) {
  state.grammarIssues[idx].status = status;
  recomputeGrammarWorkingText();
  renderGrammarIssues();
  renderOriginalWithHighlights();
}

function acceptAllGrammarIssues() {
  state.grammarIssues.forEach((i) => { if (i.status === 'pending') i.status = 'accepted'; });
  recomputeGrammarWorkingText();
  renderGrammarIssues();
  renderOriginalWithHighlights();
}

function recomputeGrammarWorkingText() {
  let working = state.lastResult.originalText;
  for (const issue of state.grammarIssues) {
    if (issue.status === 'accepted' && issue.original && working.includes(issue.original)) {
      working = working.replace(issue.original, issue.suggestion || '');
    }
  }
  $('#sideImproved').textContent = working;
  renderDiff(computeClientDiff(state.lastResult.originalText, working));
}

// Small client-side word diff fallback (mirrors server logic) used when
// recomputing after per-issue accept/ignore toggles in Grammar mode.
function computeClientDiff(a, b) {
  if (a === b) return [{ value: a, added: false, removed: false }];
  return [
    { value: a, added: false, removed: true },
    { value: b, added: true, removed: false },
  ];
}

function toggleEdit() {
  const box = $('#sideImproved');
  const editing = box.getAttribute('contenteditable') === 'true';
  box.setAttribute('contenteditable', editing ? 'false' : 'true');
  $('#editBtn').textContent = editing ? 'Edit' : 'Done editing';
  if (editing && state.lastResult) {
    // Save manual edits back into lastResult so Accept/Copy use them.
    const text = box.textContent;
    if (state.lastResult.improvedText !== undefined) state.lastResult.improvedText = text;
    if (state.lastResult.correctedText !== undefined) state.lastResult.correctedText = text;
  }
}

function currentResultText() {
  if (!state.lastResult) return '';
  return state.lastResult.correctedText !== undefined
    ? $('#sideImproved').textContent
    : state.lastResult.improvedText;
}

function copyResult() {
  const text = currentResultText();
  navigator.clipboard.writeText(text).then(
    () => flashButton($('#copyBtn'), 'Copied!'),
    () => showError('Could not copy to clipboard — select the text manually.')
  );
}

function flashButton(btn, label) {
  const original = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = original; }, 1200);
}

function acceptResult() {
  if (!state.lastResult) return;
  state.undoStack.push($('#originalText').value);
  $('#undoBtn').disabled = false;
  $('#originalText').value = currentResultText();
  flashButton($('#acceptBtn'), 'Accepted ✓');
}

function undoAccept() {
  if (state.undoStack.length === 0) return;
  $('#originalText').value = state.undoStack.pop();
  if (state.undoStack.length === 0) $('#undoBtn').disabled = true;
}

// ----------------------------------------------------------------- SETTINGS

async function loadSettings() {
  state.settings = await api('/settings');
  $('#providerBadge').textContent = `provider: ${state.settings.provider}`;
}

function loadSettingsIntoForm() {
  const s = state.settings;
  $('#providerSelect').value = s.provider;
  $('#openaiModel').value = s.openaiModel;
  $('#anthropicModel').value = s.anthropicModel;
  $('#customBaseUrl').value = s.customBaseUrl;
  $('#customModel').value = s.customModel;
  $('#openaiApiKey').placeholder = s.hasOpenaiKey ? s.openaiApiKey : 'sk-…';
  $('#anthropicApiKey').placeholder = s.hasAnthropicKey ? s.anthropicApiKey : 'sk-ant-…';
  $('#customApiKey').placeholder = s.hasCustomKey ? s.customApiKey : '(optional)';
  $('#temperatureSlider').value = s.temperature;
  $('#temperatureValue').textContent = s.temperature;
  $('#maxTokensInput').value = s.maxOutputTokens;
  $('#privacyModeToggle').checked = Boolean(s.doNotSaveText);
  $('#historyToggle').checked = Boolean(s.historyEnabled);
  updateProviderFieldsVisibility();
}

function updateProviderFieldsVisibility() {
  const provider = $('#providerSelect').value;
  ['openai', 'anthropic', 'custom'].forEach((p) => {
    $(`#providerFields-${p}`).classList.toggle('hidden', p !== provider);
  });
}

function bindSettingsView() {
  $('#providerSelect').addEventListener('change', updateProviderFieldsVisibility);
  $('#temperatureSlider').addEventListener('input', (e) => {
    $('#temperatureValue').textContent = e.target.value;
  });

  $('#saveSettingsBtn').addEventListener('click', async () => {
    const patch = {
      provider: $('#providerSelect').value,
      openaiModel: $('#openaiModel').value,
      anthropicModel: $('#anthropicModel').value,
      customBaseUrl: $('#customBaseUrl').value,
      customModel: $('#customModel').value,
      temperature: Number($('#temperatureSlider').value),
      maxOutputTokens: Number($('#maxTokensInput').value),
      doNotSaveText: $('#privacyModeToggle').checked,
      historyEnabled: $('#historyToggle').checked,
    };
    // Only send API key fields if the user actually typed something new.
    if ($('#openaiApiKey').value) patch.openaiApiKey = $('#openaiApiKey').value;
    if ($('#anthropicApiKey').value) patch.anthropicApiKey = $('#anthropicApiKey').value;
    if ($('#customApiKey').value) patch.customApiKey = $('#customApiKey').value;

    try {
      state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(patch) });
      $('#providerBadge').textContent = `provider: ${state.settings.provider}`;
      $('#openaiApiKey').value = '';
      $('#anthropicApiKey').value = '';
      $('#customApiKey').value = '';
      loadSettingsIntoForm();
      $('#settingsSavedNote').classList.remove('hidden');
      setTimeout(() => $('#settingsSavedNote').classList.add('hidden'), 2000);
    } catch (err) {
      showError(err.message, { code: err.code, errorId: err.errorId });
    }
  });
}

// -------------------------------------------------------------- MY STYLE

async function loadStyle() {
  const entries = await api('/style');
  const list = $('#styleList');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.appendChild(el('div', { class: 'empty-state', text: 'No style preferences yet — add one above.' }));
    return;
  }
  entries.forEach((entry) => {
    list.appendChild(
      el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item-head' }, [
          el('div', { class: 'list-item-body', text: entry.text }),
          el('div', { class: 'list-item-actions' }, [
            el('button', { class: 'btn btn-sm btn-ghost', text: 'Delete', onclick: () => deleteStyleEntry(entry.id) }),
          ]),
        ]),
      ])
    );
  });
}

function bindStyleView() {
  $('#addStyleBtn').addEventListener('click', async () => {
    const text = $('#newStyleText').value.trim();
    if (!text) return;
    await api('/style', { method: 'POST', body: JSON.stringify({ text }) });
    $('#newStyleText').value = '';
    loadStyle();
  });
}

async function deleteStyleEntry(id) {
  await api(`/style/${id}`, { method: 'DELETE' });
  loadStyle();
}

// --------------------------------------------------------------- PROFILES

async function loadProfiles() {
  const profiles = await api('/profiles');
  state.profiles = profiles;
  const list = $('#profilesList');
  list.innerHTML = '';
  profiles.forEach((p) => {
    list.appendChild(
      el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item-head' }, [
          el('div', {}, [
            el('div', { class: 'list-item-title', text: p.name }),
            el('div', { class: 'list-item-meta', text: p.description || '' }),
          ]),
          !p.builtIn
            ? el('div', { class: 'list-item-actions' }, [
                el('button', { class: 'btn btn-sm btn-ghost', text: 'Delete', onclick: () => deleteProfile(p.id) }),
              ])
            : el('span', { class: 'list-item-meta', text: 'built-in' }),
        ]),
      ])
    );
  });
}

async function loadProfilesIntoSelect() {
  const profiles = await api('/profiles');
  state.profiles = profiles;
  const select = $('#profileSelect');
  profiles.forEach((p) => select.appendChild(el('option', { value: p.id, text: p.name })));
}

function bindProfilesView() {
  $('#addProfileBtn').addEventListener('click', async () => {
    const name = $('#newProfileName').value.trim();
    const description = $('#newProfileDesc').value.trim();
    if (!name) return;
    await api('/profiles', { method: 'POST', body: JSON.stringify({ name, description }) });
    $('#newProfileName').value = '';
    $('#newProfileDesc').value = '';
    loadProfiles();
    refreshProfileSelect();
  });
}

async function deleteProfile(id) {
  await api(`/profiles/${id}`, { method: 'DELETE' });
  loadProfiles();
  refreshProfileSelect();
}

async function refreshProfileSelect() {
  const select = $('#profileSelect');
  const current = select.value;
  select.innerHTML = '<option value="">None</option>';
  const profiles = await api('/profiles');
  state.profiles = profiles;
  profiles.forEach((p) => select.appendChild(el('option', { value: p.id, text: p.name })));
  select.value = current;
}

// -------------------------------------------------------------- TEMPLATES

async function loadTemplates() {
  const templates = await api('/templates');
  state.templates = templates;
  const list = $('#templatesList');
  list.innerHTML = '';
  if (templates.length === 0) {
    list.appendChild(el('div', { class: 'empty-state', text: 'No templates yet.' }));
    return;
  }
  templates.forEach((t) => {
    list.appendChild(
      el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item-head' }, [
          el('div', {}, [
            el('div', { class: 'list-item-title', text: t.name }),
            el('div', { class: 'list-item-meta', text: `${t.defaultTone || 'no tone'} · ${t.defaultAction || 'no default action'}` }),
          ]),
          el('div', { class: 'list-item-actions' }, [
            el('button', { class: 'btn btn-sm btn-ghost', text: 'Delete', onclick: () => deleteTemplate(t.id) }),
          ]),
        ]),
      ])
    );
  });
}

async function loadTemplatesIntoSelect() {
  const templates = await api('/templates');
  state.templates = templates;
  const select = $('#templateSelect');
  templates.forEach((t) => select.appendChild(el('option', { value: t.id, text: t.name })));
}

function bindTemplatesView() {
  $('#addTemplateBtn').addEventListener('click', async () => {
    const name = $('#newTemplateName').value.trim();
    if (!name) return;
    await api('/templates', {
      method: 'POST',
      body: JSON.stringify({
        name,
        defaultTone: $('#newTemplateTone').value || null,
        defaultAction: $('#newTemplateAction').value || null,
      }),
    });
    $('#newTemplateName').value = '';
    loadTemplates();
    refreshTemplateSelect();
  });
}

async function deleteTemplate(id) {
  await api(`/templates/${id}`, { method: 'DELETE' });
  loadTemplates();
  refreshTemplateSelect();
}

async function refreshTemplateSelect() {
  const select = $('#templateSelect');
  const current = select.value;
  select.innerHTML = '<option value="">None</option>';
  const templates = await api('/templates');
  state.templates = templates;
  templates.forEach((t) => select.appendChild(el('option', { value: t.id, text: t.name })));
  select.value = current;
}

// ----------------------------------------------------------------- TERMS

async function loadTerms() {
  const { defaults, custom } = await api('/terms');
  const defaultsList = $('#defaultTermsList');
  defaultsList.innerHTML = '';
  defaults.forEach((t) => defaultsList.appendChild(el('span', { class: 'chip', text: t })));

  const customList = $('#customTermsList');
  customList.innerHTML = '';
  if (custom.length === 0) {
    customList.appendChild(el('div', { class: 'empty-state', text: 'No custom terms yet.' }));
  }
  custom.forEach((t) => {
    customList.appendChild(
      el('span', { class: 'chip' }, [
        document.createTextNode(t),
        el('button', { text: '×', onclick: () => deleteTerm(t) }),
      ])
    );
  });
}

function bindTermsView() {
  $('#addTermBtn').addEventListener('click', async () => {
    const term = $('#newTermInput').value.trim();
    if (!term) return;
    await api('/terms', { method: 'POST', body: JSON.stringify({ term }) });
    $('#newTermInput').value = '';
    loadTerms();
  });
}

async function deleteTerm(term) {
  await api(`/terms/${encodeURIComponent(term)}`, { method: 'DELETE' });
  loadTerms();
}

// ------------------------------------------------------- BROWSER EXTENSION

// `window.writemate` only exists when this page is running inside the
// Electron app's own window (exposed by electron/preload.cjs) — it's
// undefined in a plain browser tab (`npm run dev`), which is the signal
// used below to fall back to a manual-navigation note instead of an
// "Open folder" button that couldn't do anything.
function bindExtensionView() {
  $('#openExtensionFolderBtn').addEventListener('click', () => {
    window.writemate?.openExtensionFolder();
  });
}

async function loadExtensionView() {
  const isElectron = Boolean(window.writemate?.isElectron);
  $('#extensionNotElectronNote').classList.toggle('hidden', isElectron);
  $('#openExtensionFolderBtn').disabled = !isElectron;

  const pathField = $('#extensionFolderPath');
  if (isElectron) {
    pathField.value = await window.writemate.getExtensionFolderPath();
  } else {
    // Best-effort guess for the manual-navigation note — correct for a
    // normal `git clone`/download, but the user's actual folder name may
    // differ if they renamed the project folder.
    pathField.value = '<the project folder>/browser-extension';
  }
}

// ---------------------------------------------------------------- HISTORY

async function loadHistory() {
  const settings = await api('/settings');
  const note = $('#historyNote');
  if (!settings.historyEnabled || settings.doNotSaveText) {
    note.textContent = 'History is currently off (privacy mode default). Turn it on in Settings if you want WriteMate to remember past rewrites.';
  } else {
    note.textContent = 'History is on. Nothing here ever leaves your machine.';
  }

  const entries = await api('/history');
  const list = $('#historyList');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.appendChild(el('div', { class: 'empty-state', text: 'No history yet.' }));
    return;
  }
  entries.forEach((entry) => {
    list.appendChild(
      el('div', { class: 'list-item' }, [
        el('div', { class: 'list-item-head' }, [
          el('div', { class: 'list-item-title', text: `${entry.action || ''}${entry.tone ? ' · ' + entry.tone : ''}` }),
          el('div', { class: 'list-item-meta', text: new Date(entry.date).toLocaleString() }),
        ]),
        el('div', { class: 'list-item-body', text: `Original: ${entry.original}` }),
        el('div', { class: 'list-item-body', text: `Result: ${entry.result}` }),
        el('div', { class: 'list-item-actions', style: 'margin-top:8px' }, [
          el('button', { class: 'btn btn-sm btn-ghost', text: 'Delete', onclick: () => deleteHistoryEntry(entry.id) }),
        ]),
      ])
    );
  });
}

function bindHistoryView() {
  $('#clearHistoryBtn').addEventListener('click', async () => {
    await api('/history', { method: 'DELETE' });
    loadHistory();
  });
}

async function deleteHistoryEntry(id) {
  await api(`/history/${id}`, { method: 'DELETE' });
  loadHistory();
}

init();
