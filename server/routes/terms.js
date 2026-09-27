import { Router } from 'express';
import { store } from '../lib/store.js';
import { DEFAULT_PROTECTED_TERMS } from '../lib/protectedTerms.js';

export const termsRouter = Router();

termsRouter.get('/terms', (req, res) => {
  res.json({
    defaults: DEFAULT_PROTECTED_TERMS,
    custom: store.getCustomProtectedTerms(),
  });
});

termsRouter.post('/terms', (req, res) => {
  const { term } = req.body || {};
  if (typeof term !== 'string' || !term.trim()) {
    return res.status(400).json({ error: 'Field "term" is required.' });
  }
  res.status(201).json({ custom: store.addProtectedTerm(term.trim()) });
});

termsRouter.delete('/terms/:term', (req, res) => {
  res.json({ custom: store.removeProtectedTerm(decodeURIComponent(req.params.term)) });
});
