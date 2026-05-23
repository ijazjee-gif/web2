import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

const router = express.Router();
const cacheFile = path.resolve(process.cwd(), 'data', 'market-cache.json');
const ttlSeconds = 45;
const symbols = {
  gold: { symbol: 'GC=F', decimals: 2, prefix: '$' },
  eurusd: { symbol: 'EURUSD=X', decimals: 4, prefix: '' },
  gbpusd: { symbol: 'GBPUSD=X', decimals: 4, prefix: '' },
  usdjpy: { symbol: 'JPY=X', decimals: 2, prefix: '' },
  oil: { symbol: 'CL=F', decimals: 2, prefix: '$' }
};

function isFresh(file) {
  try { return fs.existsSync(file) && (Date.now() - fs.statSync(file).mtimeMs) < ttlSeconds * 1000; } catch { return false; }
}

function parseChartPrice(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  let price = meta.regularMarketPrice;
  const closesRaw = result.indicators?.quote?.[0]?.close || [];
  const closes = closesRaw.filter(v => v !== null && v !== undefined);
  if (price === undefined || price === null) price = closes.at(-1);
  if (price === undefined || price === null) return null;
  let previous = meta.previousClose ?? meta.chartPreviousClose ?? closes[0] ?? price;
  let direction = 'flat';
  if (previous !== null && previous !== undefined) {
    if (Number(price) > Number(previous)) direction = 'up';
    if (Number(price) < Number(previous)) direction = 'down';
  }
  return { price: Number(price), previous: Number(previous), direction };
}

router.get(['/market-prices', '/market-prices.php'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (isFresh(cacheFile)) return res.type('json').send(fs.readFileSync(cacheFile, 'utf8'));
  const items = {};
  const missing = [];
  await Promise.all(Object.entries(symbols).map(async ([key, info]) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(info.symbol)}?range=1d&interval=1m`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 xxxxxxxxxx Market Pulse' } });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = parseChartPrice(await r.json());
      if (!parsed) throw new Error('No price found');
      items[key] = { symbol: info.symbol, price: parsed.price, previous: parsed.previous, direction: parsed.direction, decimals: info.decimals, prefix: info.prefix };
    } catch {
      missing.push(key);
    }
  }));
  if (!Object.keys(items).length && fs.existsSync(cacheFile)) return res.type('json').send(fs.readFileSync(cacheFile, 'utf8'));
  if (!Object.keys(items).length) return res.status(503).json({ ok: false, message: 'Live price feed unavailable. Check server internet access.' });
  const response = { ok: true, provider: 'node-market-proxy', timestamp: Math.floor(Date.now() / 1000), items, missing };
  fs.writeFileSync(cacheFile, JSON.stringify(response, null, 2));
  res.json(response);
});

export default router;
