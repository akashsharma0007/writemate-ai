import { Router } from 'express';
import { store } from '../lib/store.js';

export const templatesRouter = Router();

templatesRouter.get('/templates', (req, res) => {
  res.json(store.getTemplates());
});

templatesRouter.post('/templates', (req, res) => {
  const { name, defaultTone, defaultAction, defaultContext } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Field "name" is required.' });
  }
  res.status(201).json(
    store.addTemplate({
      name: name.trim(),
      defaultTone: defaultTone || null,
      defaultAction: defaultAction || null,
      defaultContext: defaultContext || '',
    })
  );
});

templatesRouter.delete('/templates/:id', (req, res) => {
  store.deleteTemplate(req.params.id);
  res.status(204).end();
});
