import { Router } from 'express';
import { store } from '../lib/store.js';
import { getEffectiveSettings, maskSettings } from '../lib/effectiveSettings.js';

const ALLOWED_KEYS = [
  'provider',
  'openaiApiKey',
  'openaiModel',
  'anthropicApiKey',
  'anthropicModel',
  'customBaseUrl',
  'customApiKey',
  'customModel',
  'temperature',
  'maxOutputTokens',
  'doNotSaveText',
  'historyEnabled',
];

export const settingsRouter = Router();

settingsRouter.get('/settings', (req, res) => {
  res.json(maskSettings(getEffectiveSettings()));
});

settingsRouter.put('/settings', (req, res) => {
  const patch = {};
  for (const key of ALLOWED_KEYS) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
      patch[key] = req.body[key];
    }
  }
  // Never persist a masked key (starts-with-bullet placeholder) back over a real one.
  for (const keyField of ['openaiApiKey', 'anthropicApiKey', 'customApiKey']) {
    if (typeof patch[keyField] === 'string' && patch[keyField].includes('•')) {
      delete patch[keyField];
    }
  }
  const updated = store.updateSettings(patch);
  res.json(maskSettings({ ...updated }));
});
