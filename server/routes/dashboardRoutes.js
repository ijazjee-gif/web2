import express from 'express';
import { getAuthenticatedUser } from './authRoutes.js';
import { DEFAULT_DASHBOARD_LAYOUT, getDashboardSummary, getLayoutForUser, saveLayoutForUser } from '../services/dashboardService.js';

const router = express.Router();

router.get('/summary', async (req, res) => {
  try {
    const force = String(req.query.force || '') === '1';
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getDashboardSummary({ force }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Dashboard summary failed.' });
  }
});

router.get('/layout', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Login required.' });
  res.json({ ok: true, layout: getLayoutForUser(user.id), defaultLayout: DEFAULT_DASHBOARD_LAYOUT });
});

router.post('/layout', (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Login required.' });
  const layout = saveLayoutForUser(user.id, req.body?.layout);
  res.json({ ok: true, layout });
});

router.post('/refresh', async (req, res) => {
  try {
    res.json(await getDashboardSummary({ force: true }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Dashboard refresh failed.' });
  }
});

export default router;
