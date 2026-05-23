import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import authRouter, { getAuthenticatedUser } from './routes/authRoutes.js';
import marketPricesRouter from './routes/marketPrices.js';
import dashboardRouter from './routes/dashboardRoutes.js';
import { ensureSeedUser } from './services/userStore.js';
import { getCotPayload, getReleaseSchedulePayload, getStatusPayload, refreshCotData, startCotScheduler, stopCotScheduler } from './services/cotService.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const PUBLIC_DIR = path.join(ROOT, 'public');

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: '1h' }));
app.use('/api/auth', authRouter);
app.use('/api', marketPricesRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/cot', (req, res) => res.json(getCotPayload()));
app.get('/api/cot/status', (req, res) => res.json(getStatusPayload()));
app.post('/api/cot/refresh', async (req, res) => {
  const result = await refreshCotData('manual API refresh');
  res.status(result.ok ? 200 : 500).json({ ...result, status: getStatusPayload() });
});
app.get('/api/cot/release-schedule', async (req, res) => res.json(await getReleaseSchedulePayload()));

app.get('/api/protected-check', (req, res) => {
  const user = getAuthenticatedUser(req);
  res.status(user ? 200 : 401).json({ ok: Boolean(user), user: user ? { id: user.id, username: user.username, role: user.role } : null });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: '1h' }));
  app.get(/.*/, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  app.use(express.static(PUBLIC_DIR));
  app.get(/.*/, (req, res) => {
    res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><title>Build required</title></head><body style="font-family:sans-serif;background:#05070b;color:#fff;padding:40px"><h1>React build not found</h1><p>Run <code>npm install</code> and <code>npm run build</code>, then <code>npm start</code>. During development run <code>npm run dev</code>.</p></body></html>`);
  });
}

await ensureSeedUser();
startCotScheduler().catch(err => console.error('[COT] startup scheduler failed:', err));

const server = app.listen(PORT, HOST, () => {
  console.log(`Merged Node + React website running at http://${HOST}:${PORT}`);
});

function shutdown() {
  stopCotScheduler();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
