import { Router } from 'express';
import { TONES, ACTIONS } from '../lib/promptBuilder.js';
import { SUPPORTED_PROVIDERS } from '../providers/index.js';

const ACTION_LABELS = {
  fix_grammar: 'Fix Grammar',
  improve: 'Improve',
  rephrase: 'Rephrase',
  professional: 'Make Professional',
  friendly: 'Make Friendly',
  concise: 'Make Concise',
  clearer: 'Make Clearer',
  confident: 'Make More Confident',
  diplomatic: 'Make More Diplomatic',
  simplify: 'Simplify',
  expand: 'Expand',
  custom: 'Custom Instruction',
};

export const metaRouter = Router();

metaRouter.get('/meta', (req, res) => {
  res.json({
    tones: TONES,
    actions: Object.keys(ACTIONS).map((id) => ({ id, label: ACTION_LABELS[id] || id })),
    providers: SUPPORTED_PROVIDERS,
  });
});
