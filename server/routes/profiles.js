import { Router } from 'express';
import { store } from '../lib/store.js';

export const profilesRouter = Router();

profilesRouter.get('/profiles', (req, res) => {
  res.json(store.getProfiles());
});

profilesRouter.post('/profiles', (req, res) => {
  const { name, description } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  res.status(201).json(store.addProfile({ name: name.trim(), description: description || '' }));
});

profilesRouter.delete('/profiles/:id', (req, res) => {
  store.deleteProfile(req.params.id);
  res.status(204).end();
});
