import { Router } from 'express';
import { store } from '../lib/store.js';

export const styleRouter = Router();

styleRouter.get('/style', (req, res) => {
  res.json(store.getWritingStyle());
});

styleRouter.post('/style', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Field "text" is required.' });
  }
  res.status(201).json(store.addWritingStyleEntry(text.trim()));
});

styleRouter.put('/style/:id', (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Field "text" is required.' });
  }
  const updated = store.updateWritingStyleEntry(req.params.id, text.trim());
  if (!updated) return res.status(404).json({ error: 'Not found.' });
  res.json(updated);
});

styleRouter.delete('/style/:id', (req, res) => {
  store.deleteWritingStyleEntry(req.params.id);
  res.status(204).end();
});
