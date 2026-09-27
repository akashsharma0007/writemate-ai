import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptSecret, decryptSecret } from './secretStorage.js';

// The three settings fields that hold a real credential. Encrypted at rest
// (via secretStorage.js) when running inside the Electron desktop build;
// stored as plain text otherwise (unchanged from before this existed) — see
// secretStorage.js for why.
const SECRET_FIELDS = ['openaiApiKey', 'anthropicApiKey', 'customApiKey'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Normally the data folder lives next to the project (unchanged behavior for
// `npm run dev`/`npm start`). The Electron desktop build sets
// WRITEMATE_DATA_DIR to app.getPath('userData') *before* this module is
// first imported, because a packaged app's install folder is often
// read-only (e.g. under Program Files) and shouldn't be written to anyway —
// see electron/main.js.
const DATA_DIR = process.env.WRITEMATE_DATA_DIR
  ? path.resolve(process.env.WRITEMATE_DATA_DIR)
  : path.resolve(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULTS = {
  settings: {
    // NOTE: provider/model/temperature/maxOutputTokens are intentionally left
    // blank here (rather than a concrete default like "openai") so that a
    // freshly-created settings.json doesn't permanently shadow whatever you
    // put in .env. getEffectiveSettings() in effectiveSettings.js is what
    // applies the real fallback chain: explicit Settings-page value -> .env
    // -> a hardcoded default, in that order. Only put a concrete default
    // here if you want it to ALWAYS win over .env, even on a brand new install.
    provider: '',
    openaiApiKey: '',
    openaiModel: '',
    anthropicApiKey: '',
    anthropicModel: '',
    customBaseUrl: '',
    customApiKey: '',
    customModel: '',
    temperature: null,
    maxOutputTokens: null,
    doNotSaveText: true, // privacy mode: ON by default
    historyEnabled: false, // off by default, per brief section 19
  },
  writingStyle: [], // array of { id, text, createdAt }
  history: [], // array of { id, date, action, tone, context, original, result }
  protectedTerms: [], // user-added custom terms (defaults live in code, not storage)
  profiles: [
    { id: 'work', name: 'Work', description: 'Customer communication — professional, clear, diplomatic, technical but understandable.', builtIn: true },
    { id: 'internal', name: 'Internal', description: 'Colleagues — professional, concise, direct.', builtIn: true },
    { id: 'personal', name: 'Personal', description: 'Friendly, natural, casual.', builtIn: true },
  ],
  templates: [
    { id: 'client-email', name: 'Client Email', defaultTone: 'Professional', defaultAction: 'professional' },
    { id: 'internal-update', name: 'Internal Update', defaultTone: 'Direct', defaultAction: 'concise' },
    { id: 'ticket-response', name: 'Ticket Response', defaultTone: 'Customer-Friendly', defaultAction: 'professional' },
    { id: 'escalation', name: 'Escalation', defaultTone: 'Diplomatic', defaultAction: 'diplomatic' },
    { id: 'status-update', name: 'Status Update', defaultTone: 'Neutral', defaultAction: 'concise' },
    { id: 'follow-up', name: 'Follow-up', defaultTone: 'Friendly', defaultAction: 'friendly' },
    { id: 'meeting-summary', name: 'Meeting Summary', defaultTone: 'Neutral', defaultAction: 'clearer' },
    { id: 'technical-explanation', name: 'Technical Explanation', defaultTone: 'Technical', defaultAction: 'clearer' },
  ],
};

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readCollection(name) {
  const file = filePath(name);
  if (!fs.existsSync(file)) {
    writeCollection(name, DEFAULTS[name]);
    return structuredClone(DEFAULTS[name]);
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Corrupt file — fall back to defaults rather than crashing the app.
    return structuredClone(DEFAULTS[name]);
  }
}

function writeCollection(name, data) {
  const file = filePath(name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

export const store = {
  getSettings() {
    const merged = { ...DEFAULTS.settings, ...readCollection('settings') };
    for (const field of SECRET_FIELDS) {
      merged[field] = decryptSecret(merged[field]);
    }
    return merged;
  },
  updateSettings(patch) {
    const current = this.getSettings();
    const next = { ...current, ...patch };
    const toWrite = { ...next };
    for (const field of SECRET_FIELDS) {
      toWrite[field] = encryptSecret(toWrite[field]);
    }
    writeCollection('settings', toWrite);
    return next; // callers get the plaintext version back, same as before
  },

  getWritingStyle() {
    return readCollection('writingStyle');
  },
  addWritingStyleEntry(text) {
    const list = this.getWritingStyle();
    const entry = { id: cryptoId(), text, createdAt: new Date().toISOString() };
    list.push(entry);
    writeCollection('writingStyle', list);
    return entry;
  },
  updateWritingStyleEntry(id, text) {
    const list = this.getWritingStyle();
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx].text = text;
    writeCollection('writingStyle', list);
    return list[idx];
  },
  deleteWritingStyleEntry(id) {
    const list = this.getWritingStyle().filter((e) => e.id !== id);
    writeCollection('writingStyle', list);
  },

  getHistory() {
    return readCollection('history');
  },
  addHistoryEntry(entry) {
    const list = this.getHistory();
    const record = { id: cryptoId(), date: new Date().toISOString(), ...entry };
    list.unshift(record);
    // Cap history so the file can't grow unbounded.
    writeCollection('history', list.slice(0, 500));
    return record;
  },
  deleteHistoryEntry(id) {
    const list = this.getHistory().filter((e) => e.id !== id);
    writeCollection('history', list);
  },
  clearHistory() {
    writeCollection('history', []);
  },

  getCustomProtectedTerms() {
    return readCollection('protectedTerms');
  },
  addProtectedTerm(term) {
    const list = this.getCustomProtectedTerms();
    if (!list.includes(term)) list.push(term);
    writeCollection('protectedTerms', list);
    return list;
  },
  removeProtectedTerm(term) {
    const list = this.getCustomProtectedTerms().filter((t) => t !== term);
    writeCollection('protectedTerms', list);
    return list;
  },

  getProfiles() {
    return readCollection('profiles');
  },
  addProfile(profile) {
    const list = this.getProfiles();
    const entry = { id: cryptoId(), builtIn: false, ...profile };
    list.push(entry);
    writeCollection('profiles', list);
    return entry;
  },
  deleteProfile(id) {
    const list = this.getProfiles().filter((p) => p.id !== id || p.builtIn);
    writeCollection('profiles', list);
  },

  getTemplates() {
    return readCollection('templates');
  },
  addTemplate(template) {
    const list = this.getTemplates();
    const entry = { id: cryptoId(), ...template };
    list.push(entry);
    writeCollection('templates', list);
    return entry;
  },
  deleteTemplate(id) {
    const list = this.getTemplates().filter((t) => t.id !== id);
    writeCollection('templates', list);
  },
};

function cryptoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
