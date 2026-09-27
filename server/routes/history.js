import { Router } from 'express';
import { store } from '../lib/store.js';

export const historyRouter = Router();

historyRouter.get('/history', (req, res) => {
  res.json(store.getHistory());
});

historyRouter.delete('/history/:id', (req, res) => {
  store.deleteHistoryEntry(req.params.id);
  res.status(204).end();
});

historyRouter.delete('/history', (req, res) => {
  store.clearHistory();
  res.status(204).end();
});
