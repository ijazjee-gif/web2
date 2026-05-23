import fs from 'node:fs';
import path from 'node:path';
import { getCotPayload } from './cotService.js';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CACHE_FILE = path.join(DATA_DIR, 'dashboard-cache.json');
const LAYOUT_FILE = path.join(DATA_DIR, 'dashboard-layouts.json');
const SESSION_FILE = path.join(DATA_DIR, 'session-config.json');

const MARKET_TTL_MS = Number(process.env.DASHBOARD_MARKET_TTL_MS || 60_000);
const NEWS_TTL_MS = Number(process.env.DASHBOARD_NEWS_TTL_MS || 60_000);
const FETCH_TIMEOUT_MS = Number(process.env.DASHBOARD_FETCH_TIMEOUT_MS || 7_000);
const USER_AGENT = process.env.DASHBOARD_USER_AGENT || 'Vixtreet-Dashboard-Aggregator/1.0 (+https://vixtreet.com)';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const DEFAULT_DASHBOARD_LAYOUT = [
  'gold-risk',
  'usd-risk',
  'usd-index',
  'volatility',
  'sessions',
  'currency-strength',
  'smc-bias',
  'high-probability',
  'risk-warning',
  'watchlist',
  'pretrade'
];

export const TRADE_ASSETS = [
  { key: 'EURUSD', label: 'EUR/USD', yahoo: 'EURUSD=X', cot: /\bEURO FX\b/i, group: 'fx' },
  { key: 'GBPUSD', label: 'GBP/USD', yahoo: 'GBPUSD=X', cot: /\bBRITISH POUND\b/i, group: 'fx' },
  { key: 'USDJPY', label: 'USD/JPY', yahoo: 'JPY=X', cot: /\bJAPANESE YEN\b/i, group: 'fx', usdBase: true },
  { key: 'USDCHF', label: 'USD/CHF', yahoo: 'CHF=X', cot: /\bSWISS FRANC\b/i, group: 'fx', usdBase: true },
  { key: 'USDCAD', label: 'USD/CAD', yahoo: 'CAD=X', cot: /\bCANADIAN DOLLAR\b/i, group: 'fx', usdBase: true },
  { key: 'AUDUSD', label: 'AUD/USD', yahoo: 'AUDUSD=X', cot: /\bAUSTRALIAN DOLLAR\b/i, group: 'fx' },
  { key: 'NZDUSD', label: 'NZD/USD', yahoo: 'NZDUSD=X', cot: /\bNZ DOLLAR\b|\bNEW ZEALAND DOLLAR\b/i, group: 'fx' },
  { key: 'XAUUSD', label: 'Gold / XAUUSD', yahoo: 'GC=F', cot: /^GOLD$/i, group: 'metals' },
  { key: 'XAGUSD', label: 'Silver / XAGUSD', yahoo: 'SI=F', cot: /^SILVER$/i, group: 'metals' },
  { key: 'OIL', label: 'WTI Crude Oil', yahoo: 'CL=F', cot: /CRUDE OIL, LIGHT SWEET|WTI CRUDE OIL/i, group: 'energy' },
  { key: 'BTCUSD', label: 'Bitcoin / BTC', yahoo: 'BTC-USD', cot: /\bBITCOIN\b/i, group: 'crypto' },
  { key: 'ETHUSD', label: 'Ethereum / ETH', yahoo: 'ETH-USD', cot: /\bETHER\b/i, group: 'crypto' }
];

const MARKET_SYMBOLS = [
  ...TRADE_ASSETS,
  { key: 'DXY', label: 'US Dollar Index', yahoo: 'DX-Y.NYB', group: 'index' }
];

const DEFAULT_NEWS_FEEDS = [
  'https://www.forexlive.com/feed/',
  'https://www.fxstreet.com/rss/news',
  'https://www.dailyfx.com/feeds/market-news'
];

const DEFAULT_SESSIONS = [
  { key: 'sydney', name: 'Sydney', start: '21:00', end: '06:00', timezone: 'UTC' },
  { key: 'tokyo', name: 'Tokyo', start: '00:00', end: '09:00', timezone: 'UTC' },
  { key: 'london', name: 'London', start: '08:00', end: '17:00', timezone: 'UTC' },
  { key: 'newyork', name: 'New York', start: '13:00', end: '22:00', timezone: 'UTC' }
];

let memoryCache = loadJson(CACHE_FILE, null);
let newsMemory = null;

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[dashboard] Could not read ${file}: ${err.message}`);
    return fallback;
  }
}

function saveJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, Number(n) || 0)); }
function avg(values) { const valid = values.filter(Number.isFinite); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0; }
function round(n, d = 2) { const m = 10 ** d; return Math.round((Number(n) || 0) * m) / m; }
function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }

function escapeText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function minuteOfTime(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function utcMinute(date = new Date()) { return date.getUTCHours() * 60 + date.getUTCMinutes(); }

function isWeekdayForex(date = new Date()) {
  const day = date.getUTCDay();
  const minute = utcMinute(date);
  if (day === 0) return minute >= 22 * 60;
  if (day >= 1 && day <= 4) return true;
  if (day === 5) return minute < 22 * 60;
  return false;
}

function getSessions(date = new Date()) {
  const config = loadJson(SESSION_FILE, null)?.sessions || DEFAULT_SESSIONS;
  const weekday = isWeekdayForex(date);
  const now = utcMinute(date);
  return config.map(session => {
    const start = minuteOfTime(session.start);
    const end = minuteOfTime(session.end);
    const open = weekday && (start < end ? now >= start && now < end : now >= start || now < end);
    return { ...session, open, display: `${session.start}–${session.end} UTC` };
  });
}

function ensureSessionConfig() {
  if (!fs.existsSync(SESSION_FILE)) saveJson(SESSION_FILE, { note: 'Edit these UTC session times to change dashboard session open/closed logic.', sessions: DEFAULT_SESSIONS });
}

function getNewsFeedUrls() {
  const raw = process.env.DASHBOARD_NEWS_FEEDS || process.env.NEWS_FEEDS || '';
  const envUrls = raw.split(',').map(s => s.trim()).filter(Boolean);
  return envUrls.length ? envUrls : DEFAULT_NEWS_FEEDS;
}

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS, accept = '*/*') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: accept }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return { ok: true, status: response.status, contentType: response.headers.get('content-type') || '', text };
  } finally {
    clearTimeout(timer);
  }
}

function parseYahooChart(json, key) {
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = (quote.close || []).map(v => v == null ? null : Number(v));
  const highs = (quote.high || []).map(v => v == null ? null : Number(v));
  const lows = (quote.low || []).map(v => v == null ? null : Number(v));
  const points = closes.map((close, i) => ({
    time: timestamps[i] ? timestamps[i] * 1000 : null,
    close,
    high: highs[i] ?? close,
    low: lows[i] ?? close
  })).filter(p => Number.isFinite(p.close));
  if (!points.length) return null;
  const price = Number(meta.regularMarketPrice ?? points.at(-1).close);
  const previous = Number(meta.previousClose ?? meta.chartPreviousClose ?? points[0].close ?? price);
  const changePct = previous ? ((price - previous) / previous) * 100 : 0;
  const returns = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].close;
    const b = points[i].close;
    if (a > 0 && b > 0) returns.push(Math.log(b / a));
  }
  const mean = avg(returns);
  const variance = avg(returns.map(r => (r - mean) ** 2));
  const hv = Math.sqrt(variance) * Math.sqrt(252 * 24 * 4) * 100;
  const latest = points.at(-1);
  const recent = points.slice(-96);
  const hi = Math.max(...recent.map(p => p.high).filter(Number.isFinite));
  const lo = Math.min(...recent.map(p => p.low).filter(Number.isFinite));
  const rangePct = price ? ((hi - lo) / price) * 100 : 0;
  return {
    key,
    price: round(price, key.includes('JPY') ? 3 : 4),
    previous: round(previous, key.includes('JPY') ? 3 : 4),
    changePct: round(changePct, 3),
    direction: changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat',
    high: Number.isFinite(hi) ? round(hi, 4) : null,
    low: Number.isFinite(lo) ? round(lo, 4) : null,
    rangePct: round(rangePct, 3),
    hv: round(hv, 2),
    points: points.slice(-120).map(p => ({ t: p.time, c: round(p.close, 5), h: round(p.high, 5), l: round(p.low, 5) })),
    source: 'Yahoo Finance chart proxy',
    fetchedAt: new Date().toISOString()
  };
}

function readLegacyMarketCache() {
  const legacy = loadJson(path.join(DATA_DIR, 'market-cache.json'), null);
  const map = {};
  const legacyKeys = { XAUUSD: 'gold', EURUSD: 'eurusd', GBPUSD: 'gbpusd', USDJPY: 'usdjpy', OIL: 'oil' };
  for (const [assetKey, legacyKey] of Object.entries(legacyKeys)) {
    const item = legacy?.items?.[legacyKey];
    if (!item) continue;
    const price = Number(item.price);
    const previous = Number(item.previous ?? price);
    map[assetKey] = {
      key: assetKey,
      price,
      previous,
      changePct: previous ? round(((price - previous) / previous) * 100, 3) : 0,
      direction: item.direction || 'flat',
      high: null,
      low: null,
      rangePct: 0,
      hv: 0,
      points: [],
      source: 'legacy market cache',
      fetchedAt: new Date(Number(legacy?.timestamp || Date.now() / 1000) * 1000).toISOString()
    };
  }
  return map;
}

async function fetchMarketSnapshots() {
  const snapshots = readLegacyMarketCache();
  await Promise.all(MARKET_SYMBOLS.map(async asset => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahoo)}?range=5d&interval=15m`;
      const fetched = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, 'application/json,text/plain,*/*');
      const parsed = parseYahooChart(JSON.parse(fetched.text), asset.key);
      if (parsed) snapshots[asset.key] = { ...parsed, label: asset.label, yahoo: asset.yahoo };
    } catch (err) {
      if (!snapshots[asset.key]) {
        snapshots[asset.key] = {
          key: asset.key,
          label: asset.label,
          yahoo: asset.yahoo,
          price: null,
          previous: null,
          changePct: 0,
          direction: 'flat',
          high: null,
          low: null,
          rangePct: 0,
          hv: 0,
          points: [],
          source: `offline fallback (${err.message})`,
          fetchedAt: new Date().toISOString()
        };
      }
    }
  }));
  return snapshots;
}

function parseRssItems(xml, sourceUrl) {
  const blocks = [...String(xml || '').matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)].map(m => m[0]);
  return blocks.slice(0, 20).map(block => {
    const get = (...tags) => {
      for (const tag of tags) {
        const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = block.match(re);
        if (match) return escapeText(match[1]);
      }
      return '';
    };
    const linkAttr = block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || '';
    return {
      title: get('title'),
      description: get('description', 'summary', 'content:encoded'),
      link: get('link') || linkAttr || sourceUrl,
      publishedAt: get('pubDate', 'updated', 'published') || null,
      source: safeHost(sourceUrl),
      sourceUrl
    };
  }).filter(item => item.title);
}

function safeHost(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'news-feed'; }
}

function parseJsonFeed(text, sourceUrl) {
  try {
    const json = JSON.parse(text);
    const arr = Array.isArray(json) ? json : (json.items || json.articles || json.data || []);
    return arr.slice(0, 20).map(item => ({
      title: escapeText(item.title || item.headline || item.name),
      description: escapeText(item.description || item.summary || item.content || ''),
      link: item.url || item.link || sourceUrl,
      publishedAt: item.publishedAt || item.pubDate || item.date || item.created_at || null,
      source: item.source?.name || item.source || safeHost(sourceUrl),
      sourceUrl
    })).filter(item => item.title);
  } catch { return []; }
}

async function fetchNewsAggregator() {
  if (newsMemory?.generatedAt && Date.now() - new Date(newsMemory.generatedAt).getTime() < NEWS_TTL_MS) return newsMemory;
  const urls = getNewsFeedUrls();
  const results = [];
  const errors = [];
  await Promise.all(urls.map(async url => {
    try {
      const fetched = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, 'application/rss+xml,application/json,text/xml,text/plain,*/*');
      const items = /json/i.test(fetched.contentType) || /^\s*[\[{]/.test(fetched.text) ? parseJsonFeed(fetched.text, url) : parseRssItems(fetched.text, url);
      results.push(...items);
    } catch (err) {
      errors.push({ source: safeHost(url), url, error: err.message });
    }
  }));
  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const key = `${item.title}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const fallback = unique.length ? [] : [{
    title: 'Live RSS temporarily unavailable on this server',
    description: 'Dashboard is using price/COT fallback logic until the server has internet or feed URLs are updated in DASHBOARD_NEWS_FEEDS.',
    link: null,
    publishedAt: new Date().toISOString(),
    source: 'Vixtreet fallback',
    sourceUrl: null,
    fallback: true
  }];
  newsMemory = {
    ok: unique.length > 0,
    generatedAt: new Date().toISOString(),
    sources: urls.map(u => safeHost(u)),
    sourceUrls: urls,
    errors,
    items: (unique.length ? unique : fallback).slice(0, 40)
  };
  return newsMemory;
}

const RISK_OFF_WORDS = ['war', 'attack', 'escalation', 'geopolitical', 'sanction', 'crisis', 'safe haven', 'banking stress', 'default', 'tariff', 'recession', 'missile', 'conflict', 'risk-off', 'selloff'];
const RISK_ON_WORDS = ['risk-on', 'risk appetite', 'stocks rally', 'ceasefire', 'peace', 'deal', 'soft landing', 'stimulus', 'dovish', 'rate cut', 'cooling inflation'];
const GOLD_NEGATIVE_WORDS = ['dollar strong', 'usd strength', 'yields rise', 'hawkish', 'higher yields', 'hot cpi', 'sticky inflation', 'rate hike'];
const HIGH_IMPACT_WORDS = ['fed', 'fomc', 'powell', 'cpi', 'pce', 'nfp', 'jobs', 'payrolls', 'inflation', 'ecb', 'boe', 'boj', 'gdp', 'retail sales', 'unemployment', 'pmi', 'ism', 'rate decision'];

function wordScore(text, words, points) {
  const t = String(text || '').toLowerCase();
  return words.reduce((score, word) => score + (t.includes(word) ? points : 0), 0);
}

function scoreNewsForGold(newsItems) {
  let score = 0;
  const drivers = [];
  for (const item of newsItems.slice(0, 25)) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const itemScore = wordScore(text, RISK_OFF_WORDS, 10) + wordScore(text, RISK_ON_WORDS, -8) + wordScore(text, GOLD_NEGATIVE_WORDS, -8) + (/gold|xau|precious metal/.test(text) ? 4 : 0);
    const highImpact = wordScore(text, HIGH_IMPACT_WORDS, 2);
    if (itemScore || highImpact) drivers.push({ ...item, score: itemScore + highImpact, highImpact: highImpact > 0 });
    score += itemScore + highImpact;
  }
  return { score: clamp(score, -100, 100), drivers: drivers.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 6) };
}

function scoreNewsForUsd(newsItems) {
  let score = 0;
  const drivers = [];
  for (const item of newsItems.slice(0, 25)) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    let itemScore = 0;
    itemScore += /dollar strong|usd strength|higher yields|yields rise|hawkish|rate hike|hot cpi|sticky inflation/.test(text) ? 12 : 0;
    itemScore -= /dollar weak|usd weakness|yields fall|dovish|rate cut|cooling inflation/.test(text) ? 10 : 0;
    itemScore += wordScore(text, HIGH_IMPACT_WORDS, 1);
    if (itemScore) drivers.push({ ...item, score: itemScore, highImpact: wordScore(text, HIGH_IMPACT_WORDS, 1) > 0 });
    score += itemScore;
  }
  return { score: clamp(score, -100, 100), drivers: drivers.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 6) };
}

function sentimentLabel(score) {
  if (score >= 35) return 'Risk Off';
  if (score >= 10) return 'Neutral+';
  if (score <= -35) return 'Risk On';
  if (score <= -10) return 'Neutral-';
  return 'Neutral';
}

function usdLabel(score) {
  if (score >= 35) return 'USD Bullish';
  if (score >= 10) return 'USD Neutral+';
  if (score <= -35) return 'USD Bearish';
  if (score <= -10) return 'USD Neutral-';
  return 'USD Neutral';
}

function tradeIdeaForGold(label) {
  if (label === 'Risk Off') return 'Gold buy-dips: wait liquidity sweep + bullish confirmation.';
  if (label === 'Neutral+') return 'Gold cautiously bullish: smaller size, buy only after retest.';
  if (label === 'Risk On') return 'Avoid chasing gold longs; sell rallies only after rejection.';
  if (label === 'Neutral-') return 'Gold defensive: wait for premium rejection or stay flat.';
  return 'No aggressive gold trade; confirm with news + session liquidity.';
}

function volatilityLevel(snapshot, assetKey) {
  const range = Number(snapshot?.rangePct || 0);
  const hv = Number(snapshot?.hv || 0);
  const composite = (range * 12) + (hv / 8);
  let label = 'Low';
  if (composite >= 18) label = 'High';
  else if (composite >= 8) label = 'Medium';
  if (!range && !hv) label = 'Medium';
  return { asset: assetKey, label, score: round(composite, 2), rangePct: round(range, 3), hv: round(hv, 2), formula: 'Composite = 12×recent range% + annualized HV/8' };
}

function findCotRecord(asset) {
  const cot = getCotPayload();
  const data = cot?.data || [];
  const exact = data.find(r => asset.cot?.test(String(r.market || '')) && asset.cot?.test(String(r.rawMarket || r.market || '')));
  if (exact) return exact;
  return data.find(r => asset.cot?.test(String(r.market || r.rawMarket || ''))) || null;
}

function cotScore(record) {
  if (!record) return 0;
  const idx = Number(record.index ?? 50);
  const trend = record.trend === 'up' ? 8 : record.trend === 'down' ? -8 : 0;
  return clamp((idx - 50) * 1.2 + trend, -60, 60);
}

function trendScore(snapshot, asset) {
  const change = Number(snapshot?.changePct || 0);
  const points = snapshot?.points || [];
  const closes = points.map(p => Number(p.c)).filter(Number.isFinite);
  const shortAvg = avg(closes.slice(-8));
  const longAvg = avg(closes.slice(-40));
  let score = clamp(change * 12, -35, 35);
  if (shortAvg && longAvg) score += shortAvg > longAvg ? 12 : shortAvg < longAvg ? -12 : 0;
  if (asset.usdBase) score *= -1;
  return clamp(score, -50, 50);
}

function smcNarrative(score, snapshot, vol) {
  const price = snapshot?.price;
  const hi = snapshot?.high;
  const lo = snapshot?.low;
  const premium = price && hi && lo ? price > (hi + lo) / 2 : false;
  if (score >= 35) return premium ? 'Bullish bias, but price is in premium. Wait for discount pullback, liquidity sweep, then FVG entry.' : 'Bullish bias from trend/COT/news confluence. Look for discount retest and bullish displacement.';
  if (score <= -35) return premium ? 'Bearish continuation setup. Wait for buy-side liquidity sweep and premium rejection before short.' : 'Bearish bias, but price is discounted. Avoid chasing; wait corrective pullback into premium.';
  if (vol?.label === 'High') return 'Mixed bias with high volatility. Use confirmation only and reduce position size.';
  return 'Neutral structure. Wait for previous high/low sweep before selecting direction.';
}

function biasLabel(score) {
  if (score >= 55) return 'Strong Bullish';
  if (score >= 18) return 'Bullish';
  if (score <= -55) return 'Strong Bearish';
  if (score <= -18) return 'Bearish';
  return 'Neutral';
}

function buildBias(asset, snapshot, newsItems) {
  const record = findCotRecord(asset);
  const vol = volatilityLevel(snapshot, asset.key);
  const newsGold = scoreNewsForGold(newsItems).score;
  const newsUsd = scoreNewsForUsd(newsItems).score;
  const relevantNews = asset.key === 'XAUUSD' || asset.group === 'metals' ? newsGold : asset.group === 'fx' ? newsUsd * (asset.usdBase ? 0.9 : -0.35) : newsGold * 0.2;
  const tScore = trendScore(snapshot, asset);
  const cScore = cotScore(record);
  const vScore = vol.label === 'High' ? -8 : vol.label === 'Low' ? 3 : 0;
  const score = clamp(tScore * 0.45 + cScore * 0.30 + relevantNews * 0.20 + vScore, -100, 100);
  const label = biasLabel(score);
  return {
    key: asset.key,
    label: asset.label,
    score: round(score, 1),
    bias: label,
    direction: score > 18 ? 'bullish' : score < -18 ? 'bearish' : 'neutral',
    plan: smcNarrative(score, snapshot, vol),
    price: snapshot?.price ?? null,
    changePct: snapshot?.changePct ?? 0,
    volatility: vol,
    cot: record ? { market: record.market, index: record.index, trend: record.trend, net: record.net, change: record.change } : null,
    components: { trend: round(tScore, 1), cot: round(cScore, 1), news: round(relevantNews, 1), volatility: vScore },
    method: 'Daily automated SMC bias = trend structure + COT index + RSS/JSON news score + volatility filter.'
  };
}

function buildCurrencyStrength(snapshots) {
  const weights = { USD: [], EUR: [], GBP: [], JPY: [], CHF: [], CAD: [], AUD: [], NZD: [] };
  const addPair = (pair, base, quote, usdBase = false) => {
    const ch = Number(snapshots[pair]?.changePct || 0);
    const baseMove = usdBase ? ch : ch;
    weights[base]?.push(baseMove);
    weights[quote]?.push(-baseMove);
  };
  addPair('EURUSD', 'EUR', 'USD');
  addPair('GBPUSD', 'GBP', 'USD');
  addPair('AUDUSD', 'AUD', 'USD');
  addPair('NZDUSD', 'NZD', 'USD');
  addPair('USDJPY', 'USD', 'JPY', true);
  addPair('USDCHF', 'USD', 'CHF', true);
  addPair('USDCAD', 'USD', 'CAD', true);
  return Object.entries(weights).map(([currency, values]) => {
    const move = avg(values);
    const value = round(clamp(5 + move * 2.8, 0, 10), 1);
    return { currency, value, move: round(move, 3), status: value >= 6 ? 'strong' : value <= 4 ? 'weak' : 'neutral' };
  }).sort((a, b) => b.value - a.value);
}

function pickHighProbability(biases) {
  const candidates = biases
    .map(b => ({ ...b, probabilityScore: round(Math.abs(b.score) + Math.abs((b.cot?.index ?? 50) - 50) * 0.8 - (b.volatility.label === 'High' ? 10 : 0), 1) }))
    .filter(b => b.direction !== 'neutral')
    .sort((a, b) => b.probabilityScore - a.probabilityScore);
  const top = candidates[0] || biases[0];
  const direction = top?.direction === 'bearish' ? 'SELL bias' : top?.direction === 'bullish' ? 'BUY bias' : 'Wait';
  return {
    key: top?.key || 'XAUUSD',
    label: top?.label || 'Gold / XAUUSD',
    direction,
    probabilityScore: top?.probabilityScore || 0,
    reason: top?.cot ? `COT ${top.cot.index}/100 with ${top.bias} daily bias.` : `${top?.bias || 'Neutral'} daily bias from price/news model.`,
    plan: top?.direction === 'bearish' ? 'Wait premium retest + liquidity sweep, then sell with reduced risk.' : top?.direction === 'bullish' ? 'Wait discount retest + bullish displacement, then buy with defined stop.' : 'No clean directional edge. Stand aside until confirmation.'
  };
}

function riskWarning(newsItems) {
  const scored = newsItems.map(item => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const score = wordScore(text, HIGH_IMPACT_WORDS, 10) + wordScore(text, RISK_OFF_WORDS, 7) + wordScore(text, GOLD_NEGATIVE_WORDS, 5);
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0] || null;
  const high = top && top.score >= 20;
  return {
    level: high ? 'High Risk' : 'Moderate Risk',
    title: top?.title || 'No high-impact headline found',
    source: top?.source || 'RSS/JSON aggregator',
    link: top?.link || null,
    publishedAt: top?.publishedAt || null,
    message: high ? 'Reduce size, avoid tight stops, and wait 10–15 minutes after the headline/release before execution.' : 'Normal risk control. Still confirm spread, liquidity and session timing before entry.',
    plan: high ? 'Trade plan: half risk or no trade until candle closes after news spike.' : 'Trade plan: normal confirmation workflow with news monitor open.'
  };
}

function marketStatusPayload(date = new Date()) {
  const open = isWeekdayForex(date);
  return { open, label: open ? 'OPEN' : 'CLOSED', detail: open ? '24/5 Forex active' : 'Weekend / market close window' };
}

export async function getDashboardSummary({ force = false } = {}) {
  ensureSessionConfig();
  if (!force && memoryCache?.generatedAt && Date.now() - new Date(memoryCache.generatedAt).getTime() < MARKET_TTL_MS) return memoryCache;
  const [snapshots, news] = await Promise.all([fetchMarketSnapshots(), fetchNewsAggregator()]);
  const newsItems = news.items || [];
  const goldNews = scoreNewsForGold(newsItems);
  const usdNews = scoreNewsForUsd(newsItems);
  const goldSnapshot = snapshots.XAUUSD;
  const goldVol = volatilityLevel(goldSnapshot, 'XAUUSD');
  const goldCot = findCotRecord(TRADE_ASSETS.find(a => a.key === 'XAUUSD'));
  const goldRiskScore = clamp(goldNews.score + trendScore(goldSnapshot, TRADE_ASSETS.find(a => a.key === 'XAUUSD')) * 0.25 + cotScore(goldCot) * 0.20 + (goldVol.label === 'High' ? 8 : 0), -100, 100);
  const goldLabel = sentimentLabel(goldRiskScore);

  const dxy = snapshots.DXY || { price: 104.72, changePct: 0.21, direction: 'up' };
  const usdRiskScore = clamp(usdNews.score + Number(dxy.changePct || 0) * 12, -100, 100);
  const usdRiskLabel = usdLabel(usdRiskScore);

  const biases = TRADE_ASSETS.map(asset => buildBias(asset, snapshots[asset.key], newsItems));
  const highProbability = pickHighProbability(biases);
  const volatility = ['XAUUSD', 'EURUSD', 'GBPUSD'].map(key => volatilityLevel(snapshots[key], key));
  const currencyStrength = buildCurrencyStrength(snapshots);
  const watchlist = biases.map(b => ({
    key: b.key,
    symbol: b.label,
    trend: b.bias,
    volatility: b.volatility.label,
    score: b.score,
    plan: b.direction === 'bullish' ? 'Buy pullback after confirmation' : b.direction === 'bearish' ? 'Sell rally after confirmation' : 'Wait for sweep + confirmation'
  }));

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    refreshSeconds: Math.round(MARKET_TTL_MS / 1000),
    marketStatus: marketStatusPayload(),
    goldRisk: {
      label: goldLabel,
      score: round(goldRiskScore, 1),
      tradeIdea: tradeIdeaForGold(goldLabel),
      drivers: goldNews.drivers,
      formula: 'Gold risk score = RSS/JSON headline score + price trend + COT score + volatility risk filter.'
    },
    usdRisk: {
      label: usdRiskLabel,
      score: round(usdRiskScore, 1),
      drivers: usdNews.drivers,
      formula: 'USD risk score = USD headline score + DXY momentum filter.'
    },
    usdIndex: {
      value: dxy.price ?? 104.72,
      changePct: dxy.changePct ?? 0,
      direction: dxy.direction || 'flat',
      source: dxy.source || 'fallback'
    },
    volatility,
    sessions: getSessions(),
    sessionConfigFile: 'data/session-config.json',
    currencyStrength,
    assets: TRADE_ASSETS.map(({ key, label }) => ({ key, label })),
    smcBiases: biases,
    highProbability,
    riskWarning: riskWarning(newsItems),
    watchlist,
    news: { ...news, items: newsItems.slice(0, 8) },
    sources: {
      market: 'Yahoo Finance chart proxy with local cache fallback',
      cot: 'Existing CFTC COT cache/service',
      newsFeeds: getNewsFeedUrls()
    }
  };
  memoryCache = payload;
  saveJson(CACHE_FILE, payload);
  return payload;
}

export function getLayoutForUser(userId) {
  const all = loadJson(LAYOUT_FILE, { users: {} });
  const saved = all.users?.[String(userId)];
  if (!Array.isArray(saved)) return DEFAULT_DASHBOARD_LAYOUT;
  const allowed = new Set(DEFAULT_DASHBOARD_LAYOUT);
  const cleaned = saved.filter(id => allowed.has(id));
  for (const id of DEFAULT_DASHBOARD_LAYOUT) if (!cleaned.includes(id)) cleaned.push(id);
  return cleaned;
}

export function saveLayoutForUser(userId, layout) {
  const allowed = new Set(DEFAULT_DASHBOARD_LAYOUT);
  const cleaned = Array.isArray(layout) ? layout.filter(id => allowed.has(id)) : [];
  for (const id of DEFAULT_DASHBOARD_LAYOUT) if (!cleaned.includes(id)) cleaned.push(id);
  const all = loadJson(LAYOUT_FILE, { users: {} });
  all.users = all.users || {};
  all.users[String(userId)] = cleaned;
  all.updatedAt = new Date().toISOString();
  saveJson(LAYOUT_FILE, all);
  return cleaned;
}
