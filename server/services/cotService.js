import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const CACHE_FILE = path.join(DATA_DIR, 'cot-cache.json');
const STATE_FILE = path.join(DATA_DIR, 'cot-update-state.json');

const CFTC_COT_CSV_URL = process.env.CFTC_COT_CSV_URL ||
  'https://publicreporting.cftc.gov/api/views/6dca-aqww/rows.csv?accessType=DOWNLOAD&bom=true&format=true';
const CFTC_RELEASE_SCHEDULE_URL = process.env.CFTC_RELEASE_SCHEDULE_URL ||
  'https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm';
const CFTC_COT_PAGE_URL = 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm';
const CFTC_TIMEZONE = 'America/New_York';
const SITE_TIMEZONE = process.env.SITE_TIMEZONE || 'Europe/Paris';
const REFRESH_RETRY_MINUTES = Number(process.env.REFRESH_RETRY_MINUTES || 15);
const REFRESH_RETRY_LIMIT = Number(process.env.REFRESH_RETRY_LIMIT || 8);
const COT_FETCH_TIMEOUT_MS = Number(process.env.COT_FETCH_TIMEOUT_MS || 10 * 60 * 1000);
const COT_FETCH_RETRY_ATTEMPTS = Number(process.env.COT_FETCH_RETRY_ATTEMPTS || 3);
const SCHEDULE_FETCH_TIMEOUT_MS = Number(process.env.SCHEDULE_FETCH_TIMEOUT_MS || 60 * 1000);
const SCHEDULE_FETCH_RETRY_ATTEMPTS = Number(process.env.SCHEDULE_FETCH_RETRY_ATTEMPTS || 2);
const FETCH_RETRY_BASE_DELAY_MS = Number(process.env.FETCH_RETRY_BASE_DELAY_MS || 5000);
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

fs.mkdirSync(DATA_DIR, { recursive: true });

let cache = loadJson(CACHE_FILE, null) || createEmptyCache();
let state = loadJson(STATE_FILE, {}) || {};
let schedulerTimer = null;
let retryTimer = null;
let refreshInProgress = false;
let lastError = null;
let releaseSchedule = [];
let started = false;
let schedulerStatus = {
  lastCheckedAt: null,
  nextReleaseAt: null,
  nextAutoUpdateAt: null,
  scheduleSource: CFTC_RELEASE_SCHEDULE_URL,
  usingFallbackSchedule: false
};

function createEmptyCache() {
  return {
    meta: {
      generatedAt: null,
      lastSuccessfulFetchAt: null,
      lastUpdateAt: null,
      reportDate: null,
      source: CFTC_COT_CSV_URL,
      sourceLabel: 'CFTC PRE Legacy Futures Only',
      records: 0,
      markets: 0,
      note: 'Cache is empty. Start the server with internet access so it can fetch CFTC data.'
    },
    data: []
  };
}

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[WARN] Could not load ${file}:`, err.message);
    return fallback;
  }
}

function saveJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function formatDateTime(dateLike, timeZone = SITE_TIMEZONE) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(d);
}

function formatPlainDate(isoDate) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }).format(d);
}

function normaliseHeader(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  if (cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; if (row.some(v => String(v).trim() !== '')) rows.push(row); row = []; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); if (row.some(v => String(v).trim() !== '')) rows.push(row); }
  return rows;
}

function buildHeaderIndex(headers) {
  const map = new Map();
  headers.forEach((h, i) => map.set(normaliseHeader(h), i));
  return map;
}

function findIndex(headerIndex, candidates) {
  for (const c of candidates) {
    const idx = headerIndex.get(normaliseHeader(c));
    if (idx !== undefined) return idx;
  }
  return -1;
}

function getValue(row, idx) { return idx < 0 || idx >= row.length ? '' : row[idx]; }

function cleanMarketName(name) {
  return String(name || '').replace(/\s+/g, ' ').replace(/ - (CHICAGO|NEW YORK|COMMODITY|ICE|COINBASE|CBOE|MIAX|NODAL).*$/i, '').trim();
}

function classifyMarket(name) {
  const n = String(name || '').toUpperCase();
  if (/BITCOIN|ETHER|DOGECOIN|SOLANA|XRP|LITECOIN|CRYPTO/.test(n)) return 'Crypto';
  if (/S&P|NASDAQ|RUSSELL|DOW|VIX|INDEX/.test(n)) return 'Indices';
  if (/EURO|YEN|POUND|FRANC|CANADIAN|AUSTRALIAN|NEW ZEALAND|MEXICAN|BRAZILIAN|DOLLAR|USD|PESO|REAL|RAND/.test(n)) return 'Currencies';
  if (/TREASURY|T-NOTE|T-BOND|FED FUNDS|SOFR|EURODOLLAR|BOND|NOTE|MUNI/.test(n)) return 'Bonds & Rates';
  if (/CRUDE|WTI|BRENT|GASOLINE|HEATING OIL|NATURAL GAS|PROPANE|DIESEL|ETHANOL|POWER|ENERGY|EMISSIONS/.test(n)) return 'Energy';
  if (/GOLD|SILVER|COPPER|PLATINUM|PALLADIUM|ALUMINUM|ZINC|LITHIUM|STEEL|METAL/.test(n)) return 'Metals';
  if (/CORN|WHEAT|SOY|OATS|RICE|CANOLA|ROUGH RICE|GRAIN|MEAL|OILSEED/.test(n)) return 'Grains';
  if (/COFFEE|COCOA|SUGAR|COTTON|ORANGE|LUMBER|RUBBER/.test(n)) return 'Softs';
  if (/CATTLE|HOG|PORK|FEEDER|LEAN|LIVESTOCK|MEAT/.test(n)) return 'Meats';
  return 'Other';
}

function makeMarketKey(record) { return `${record.contractCode || record.marketCode || ''}__${record.market}`.toUpperCase(); }

function parseReportDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const direct = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  if (!Number.isNaN(direct.getTime()) && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return direct;
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  const mdY = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mdY) return new Date(Date.UTC(Number(mdY[3]), Number(mdY[1]) - 1, Number(mdY[2])));
  const yyMMdd = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (yyMMdd) {
    const yy = Number(yyMMdd[1]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return new Date(Date.UTC(year, Number(yyMMdd[2]) - 1, Number(yyMMdd[3])));
  }
  return null;
}

function processCotCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CFTC CSV did not contain data rows.');
  const headers = rows[0];
  const headerIndex = buildHeaderIndex(headers);
  const col = {
    market: findIndex(headerIndex, ['Market_and_Exchange_Names', 'Market and Exchange Names', 'Market_and_Exchange_Name', 'Market Exchange Names']),
    reportDate: findIndex(headerIndex, ['Report_Date_as_YYYY_MM_DD', 'Report_Date_as_YYYY-MM-DD', 'Report Date as YYYY-MM-DD','As_of_Date_Form_YYYY-MM-DD', 'As of Date in Form YYYY-MM-DD', 'As_of_Date_Form_YYYY_MM_DD','As_of_Date_In_Form_YYMMDD', 'As of Date in Form YYMMDD']),
    contractName: findIndex(headerIndex, ['CONTRACT_MARKET_NAME', 'Contract Market Name']),
    contractCode: findIndex(headerIndex, ['CFTC_Contract_Market_Code', 'CFTC Contract Market Code', 'CFTC Contract Market Code Quotes']),
    marketCode: findIndex(headerIndex, ['CFTC_Market_Code', 'CFTC Market Code', 'CFTC Market Code in Initials', 'CFTC Market Code in Initials Quotes']),
    commodityCode: findIndex(headerIndex, ['CFTC_Commodity_Code', 'CFTC Commodity Code', 'CFTC Commodity Code Quotes']),
    oi: findIndex(headerIndex, ['Open_Interest_All', 'Open Interest All', 'Open Interest (All)']),
    nonCommLong: findIndex(headerIndex, ['NonComm_Positions_Long_All', 'Noncomm_Positions_Long_All', 'Noncommercial_Positions_Long_All','Non-Commercial Positions Long All', 'Noncommercial Positions-Long (All)', 'Noncommercial Positions Long All']),
    nonCommShort: findIndex(headerIndex, ['NonComm_Positions_Short_All', 'Noncomm_Positions_Short_All', 'Noncommercial_Positions_Short_All','Non-Commercial Positions Short All', 'Noncommercial Positions-Short (All)', 'Noncommercial Positions Short All']),
    commLong: findIndex(headerIndex, ['Comm_Positions_Long_All', 'Commercial_Positions_Long_All', 'Commercial Positions Long All','Commercial Positions-Long (All)', 'Commercial Positions Long (All)']),
    commShort: findIndex(headerIndex, ['Comm_Positions_Short_All', 'Commercial_Positions_Short_All', 'Commercial Positions Short All','Commercial Positions-Short (All)', 'Commercial Positions Short (All)']),
    smallLong: findIndex(headerIndex, ['NonRept_Positions_Long_All', 'Nonreportable_Positions_Long_All', 'Non Reportable Positions Long All','Nonreportable Positions-Long (All)', 'Nonreportable Positions Long All']),
    smallShort: findIndex(headerIndex, ['NonRept_Positions_Short_All', 'Nonreportable_Positions_Short_All', 'Non Reportable Positions Short All','Nonreportable Positions-Short (All)', 'Nonreportable Positions Short All']),
    changeCommLong: findIndex(headerIndex, ['Change_in_Comm_Long_All', 'Change_in_Commercial_Long_All', 'Change in Comm Long All','Change in Commercial-Long (All)', 'Change in Commercial Long All']),
    changeCommShort: findIndex(headerIndex, ['Change_in_Comm_Short_All', 'Change_in_Commercial_Short_All', 'Change in Comm Short All','Change in Commercial-Short (All)', 'Change in Commercial Short All'])
  };
  const required = ['market', 'reportDate', 'oi', 'commLong', 'commShort', 'nonCommLong', 'nonCommShort', 'smallLong', 'smallShort'];
  const missing = required.filter(key => col[key] < 0);
  if (missing.length) throw new Error(`CFTC CSV missing expected columns: ${missing.join(', ')}. Available headers: ${headers.slice(0, 30).join(' | ')}`);

  const allRecords = [];
  let latestDate = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const reportDateObj = parseReportDate(getValue(r, col.reportDate));
    if (!reportDateObj) continue;
    const reportDate = reportDateObj.toISOString().slice(0, 10);
    if (!latestDate || reportDate > latestDate) latestDate = reportDate;
    const rawMarket = getValue(r, col.market) || getValue(r, col.contractName);
    const market = cleanMarketName(rawMarket);
    if (!market) continue;
    const commLong = parseNumber(getValue(r, col.commLong));
    const commShort = parseNumber(getValue(r, col.commShort));
    const nonCommLong = parseNumber(getValue(r, col.nonCommLong));
    const nonCommShort = parseNumber(getValue(r, col.nonCommShort));
    const smallLong = parseNumber(getValue(r, col.smallLong));
    const smallShort = parseNumber(getValue(r, col.smallShort));
    const oi = parseNumber(getValue(r, col.oi));
    if ([commLong, commShort, nonCommLong, nonCommShort, smallLong, smallShort, oi].some(v => v === null)) continue;
    const changeCommLong = parseNumber(getValue(r, col.changeCommLong)) || 0;
    const changeCommShort = parseNumber(getValue(r, col.changeCommShort)) || 0;
    allRecords.push({
      cat: classifyMarket(rawMarket), market, rawMarket,
      code: getValue(r, col.contractCode) || getValue(r, col.marketCode) || getValue(r, col.commodityCode) || '',
      contractCode: getValue(r, col.contractCode) || '', marketCode: getValue(r, col.marketCode) || '', commodityCode: getValue(r, col.commodityCode) || '',
      reportDate, cLong: commLong, cShort: commShort, net: commLong - commShort, change: changeCommLong - changeCommShort,
      lLong: nonCommLong, lShort: nonCommShort, sLong: smallLong, sShort: smallShort, oi,
      price: null, trend: 'flat', index: 50, highNet26: null, lowNet26: null
    });
  }
  if (!latestDate) throw new Error('Could not determine latest report date from CFTC CSV.');
  const byKey = new Map();
  for (const record of allRecords) {
    const key = makeMarketKey(record);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(record);
  }
  const latest = [];
  for (const [, list] of byKey.entries()) {
    list.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    const current = list.find(r => r.reportDate === latestDate);
    if (!current) continue;
    const last26 = list.slice(0, 26).map(r => r.net).filter(v => Number.isFinite(v));
    const min = Math.min(...last26);
    const max = Math.max(...last26);
    const index = max === min ? 50 : Math.round(((current.net - min) / (max - min)) * 100);
    current.index = Math.max(0, Math.min(100, index));
    current.highNet26 = max;
    current.lowNet26 = min;
    current.trend = current.change > 0 ? 'up' : current.change < 0 ? 'down' : 'flat';
    latest.push(current);
  }
  const catOrder = ['Indices', 'Currencies', 'Bonds & Rates', 'Energy', 'Metals', 'Grains', 'Softs', 'Meats', 'Crypto', 'Other'];
  latest.sort((a, b) => {
    const ca = catOrder.indexOf(a.cat);
    const cb = catOrder.indexOf(b.cat);
    if (ca !== cb) return ca - cb;
    return a.market.localeCompare(b.market);
  });
  return { latestDate, totalRows: rows.length - 1, markets: latest.length, data: latest };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function getErrorMessage(err) { return typeof err === 'string' ? err : (err?.message || String(err || 'Unknown error')); }
function isAbortError(err) { return err?.name === 'AbortError' || /aborted|abort|timed out|timeout/i.test(getErrorMessage(err)); }

async function fetchText(url, timeoutMs = 120000, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 1));
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs || FETCH_RETRY_BASE_DELAY_MS));
  const label = options.label || url;
  let lastErrorForThrow = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Vixtreet-COT-Dynamic/2.0 (+https://vixtreet.com)', 'Accept': 'text/csv,text/plain,text/html,application/json,*/*' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.text();
    } catch (err) {
      const msg = isAbortError(err) ? `Request timed out after ${Math.round(timeoutMs / 1000)} seconds` : getErrorMessage(err);
      lastErrorForThrow = new Error(`${label}: ${msg}`);
      if (attempt >= attempts) break;
      const waitMs = retryDelayMs * attempt;
      console.warn(`[FETCH] ${label} failed on attempt ${attempt}/${attempts}: ${msg}. Retrying in ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    } finally { clearTimeout(timer); }
  }
  throw lastErrorForThrow || new Error(`${label}: Fetch failed`);
}

export async function refreshCotData(reason = 'manual') {
  if (refreshInProgress) return { ok: false, skipped: true, reason: 'Refresh already in progress.' };
  refreshInProgress = true;
  const previousReportDate = cache?.meta?.reportDate || null;
  try {
    console.log(`[COT] Fetching official CFTC data (${reason})...`);
    const csv = await fetchText(CFTC_COT_CSV_URL, COT_FETCH_TIMEOUT_MS, { attempts: COT_FETCH_RETRY_ATTEMPTS, label: 'CFTC COT CSV' });
    const processed = processCotCsv(csv);
    const now = new Date().toISOString();
    cache = {
      meta: {
        generatedAt: now,
        lastSuccessfulFetchAt: now,
        lastUpdateAt: now,
        reportDate: processed.latestDate,
        reportDateFormatted: formatPlainDate(processed.latestDate),
        lastUpdateFormatted: formatDateTime(now),
        source: CFTC_COT_CSV_URL,
        sourcePage: CFTC_COT_PAGE_URL,
        sourceLabel: 'CFTC Public Reporting Environment - Legacy Futures Only',
        records: processed.totalRows,
        markets: processed.markets,
        cftcReleaseSchedule: CFTC_RELEASE_SCHEDULE_URL,
        priceColumnNote: 'Price change is not included in the official CFTC Legacy COT dataset, so this page displays N/A for price change unless you connect a separate price feed.',
        cotIndexNote: 'COT Index is calculated by Vixtreet from Commercial net positions versus the last 26 report weeks.'
      },
      data: processed.data
    };
    saveJson(CACHE_FILE, cache);
    lastError = null;
    const changed = previousReportDate !== processed.latestDate;
    console.log(`[COT] Updated cache. Report date: ${processed.latestDate}. Markets: ${processed.markets}. Changed: ${changed}`);
    return { ok: true, changed, reportDate: processed.latestDate, markets: processed.markets };
  } catch (err) {
    lastError = { message: err.message, at: new Date().toISOString(), reason };
    console.error('[COT] Refresh failed:', err);
    return { ok: false, error: err.message };
  } finally { refreshInProgress = false; }
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const out = {};
  for (const p of parts) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

function zonedTimeToUtc(year, monthIndex, day, hour, minute, second = 0, timeZone = CFTC_TIMEZONE) {
  const desiredAsUtc = Date.UTC(year, monthIndex, day, hour, minute, second);
  const guess = new Date(desiredAsUtc);
  const actual = getZonedParts(guess, timeZone);
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  const offset = actualAsUtc - guess.getTime();
  return new Date(desiredAsUtc - offset);
}

function stripHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function parseReleaseSchedule(html, baseDate = new Date()) {
  const text = stripHtml(html);
  const months = ['January', 'February', 'March', 'April', 'May', 'June','July', 'August', 'September', 'October', 'November', 'December'];
  const schedules = [];
  const yearMatches = [...text.matchAll(/(20\d{2})\s+Release Schedule/gi)];
  for (let y = 0; y < yearMatches.length; y++) {
    const year = Number(yearMatches[y][1]);
    const start = yearMatches[y].index;
    const end = y + 1 < yearMatches.length ? yearMatches[y + 1].index : text.length;
    const block = text.slice(start, end);
    for (let mi = 0; mi < months.length; mi++) {
      const month = months[mi];
      const nextMonthNames = months.slice(mi + 1).join('|');
      const re = new RegExp(`${month}\\s+([0-9*\\s]+?)(?=${nextMonthNames ? `\\s+(?:${nextMonthNames})` : '\\s+\\*Delayed|\\s+##|$'})`, 'i');
      const m = block.match(re);
      if (!m) continue;
      const dateTokens = [...m[1].matchAll(/(\d{2})(\*)?/g)];
      for (const token of dateTokens) {
        const day = Number(token[1]);
        const delayed = Boolean(token[2]);
        if (day < 1 || day > 31) continue;
        const releaseAt = zonedTimeToUtc(year, mi, day, 15, 30, 0, CFTC_TIMEZONE);
        const autoUpdateAt = zonedTimeToUtc(year, mi, day, 16, 30, 0, CFTC_TIMEZONE);
        schedules.push({ releaseDate: `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, delayed, releaseAt: releaseAt.toISOString(), autoUpdateAt: autoUpdateAt.toISOString(), releaseAtEastern: formatDateTime(releaseAt, CFTC_TIMEZONE), autoUpdateAtEastern: formatDateTime(autoUpdateAt, CFTC_TIMEZONE), autoUpdateAtSite: formatDateTime(autoUpdateAt, SITE_TIMEZONE) });
      }
    }
  }
  schedules.sort((a, b) => new Date(a.autoUpdateAt) - new Date(b.autoUpdateAt));
  const currentYear = baseDate.getUTCFullYear();
  return schedules.filter(s => Number(s.releaseDate.slice(0, 4)) >= currentYear - 1);
}

function fallbackSchedule(now = new Date()) {
  const result = [];
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 14));
  for (let i = 0; i < 400; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (d.getUTCDay() !== 5) continue;
    const year = d.getUTCFullYear();
    const monthIndex = d.getUTCMonth();
    const date = d.getUTCDate();
    const releaseAt = zonedTimeToUtc(year, monthIndex, date, 15, 30, 0, CFTC_TIMEZONE);
    const autoUpdateAt = zonedTimeToUtc(year, monthIndex, date, 16, 30, 0, CFTC_TIMEZONE);
    result.push({ releaseDate: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`, delayed: false, fallback: true, releaseAt: releaseAt.toISOString(), autoUpdateAt: autoUpdateAt.toISOString(), releaseAtEastern: formatDateTime(releaseAt, CFTC_TIMEZONE), autoUpdateAtEastern: formatDateTime(autoUpdateAt, CFTC_TIMEZONE), autoUpdateAtSite: formatDateTime(autoUpdateAt, SITE_TIMEZONE) });
  }
  return result;
}

export async function loadReleaseSchedule() {
  schedulerStatus.lastCheckedAt = new Date().toISOString();
  try {
    const html = await fetchText(CFTC_RELEASE_SCHEDULE_URL, SCHEDULE_FETCH_TIMEOUT_MS, { attempts: SCHEDULE_FETCH_RETRY_ATTEMPTS, retryDelayMs: 2000, label: 'CFTC release schedule' });
    const parsed = parseReleaseSchedule(html);
    if (!parsed.length) throw new Error('Release schedule parser found no dates.');
    schedulerStatus.usingFallbackSchedule = false;
    releaseSchedule = parsed;
  } catch (err) {
    console.error('[SCHEDULE] Could not load CFTC release schedule. Using Friday fallback:', err.message);
    schedulerStatus.usingFallbackSchedule = true;
    releaseSchedule = fallbackSchedule();
  }
  updateSchedulerStatus();
  return releaseSchedule;
}

function updateSchedulerStatus(now = new Date()) {
  const next = releaseSchedule.find(item => new Date(item.autoUpdateAt) > now);
  schedulerStatus.nextReleaseAt = next?.releaseAt || null;
  schedulerStatus.nextAutoUpdateAt = next?.autoUpdateAt || null;
  schedulerStatus.nextReleaseAtEastern = next?.releaseAtEastern || null;
  schedulerStatus.nextAutoUpdateAtEastern = next?.autoUpdateAtEastern || null;
  schedulerStatus.nextAutoUpdateAtSite = next?.autoUpdateAtSite || null;
}

function getMostRecentScheduledRelease(now = new Date()) {
  const past = releaseSchedule.filter(item => new Date(item.autoUpdateAt) <= now);
  return past[past.length - 1] || null;
}

async function schedulerLoop() {
  clearTimeout(schedulerTimer);
  await loadReleaseSchedule();
  const now = new Date();
  const recent = getMostRecentScheduledRelease(now);
  if (recent && state.lastScheduledReleaseDate !== recent.releaseDate) {
    const previousReportDate = cache?.meta?.reportDate || null;
    const result = await refreshCotData(`scheduled release ${recent.releaseDate} +1h`);
    state.lastScheduledAttemptDate = recent.releaseDate;
    state.lastScheduledAttemptAt = new Date().toISOString();
    state.lastScheduledResult = result;
    if (result.ok) {
      state.lastScheduledReleaseDate = recent.releaseDate;
      state.lastScheduledFetchAt = state.lastScheduledAttemptAt;
    }
    saveJson(STATE_FILE, state);
    if (!result.ok || (previousReportDate && result.reportDate === previousReportDate)) scheduleRetry(recent.releaseDate, 1);
  }
  updateSchedulerStatus();
  const next = releaseSchedule.find(item => new Date(item.autoUpdateAt) > now);
  const nextTime = next ? new Date(next.autoUpdateAt).getTime() + 2000 : now.getTime() + MAX_TIMEOUT_MS;
  const delay = Math.max(60_000, Math.min(MAX_TIMEOUT_MS, nextTime - now.getTime()));
  schedulerTimer = setTimeout(schedulerLoop, delay);
}

function scheduleRetry(releaseDate, attempt) {
  if (attempt > REFRESH_RETRY_LIMIT) return console.warn(`[COT] Retry limit reached for release ${releaseDate}.`);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(async () => {
    const before = cache?.meta?.reportDate || null;
    const result = await refreshCotData(`retry ${attempt} for release ${releaseDate}`);
    const at = new Date().toISOString();
    state.lastRetry = { releaseDate, attempt, at, result };
    if (result.ok) {
      state.lastScheduledReleaseDate = releaseDate;
      state.lastScheduledFetchAt = at;
      state.lastScheduledResult = result;
    }
    saveJson(STATE_FILE, state);
    if (!result.ok || result.reportDate === before) scheduleRetry(releaseDate, attempt + 1);
  }, REFRESH_RETRY_MINUTES * 60_000);
}

export function getStatusPayload() {
  updateSchedulerStatus();
  return {
    ok: true,
    cacheReady: Boolean(cache?.data?.length),
    refreshInProgress,
    lastError,
    meta: cache.meta,
    scheduler: schedulerStatus,
    state,
    serverTime: new Date().toISOString(),
    serverTimeFormatted: formatDateTime(new Date()),
    source: { cotCsv: CFTC_COT_CSV_URL, cftcCotPage: CFTC_COT_PAGE_URL, releaseSchedule: CFTC_RELEASE_SCHEDULE_URL }
  };
}

export function getCotPayload() {
  return { ok: true, meta: cache.meta, data: cache.data || [], status: getStatusPayload() };
}

export async function startCotScheduler() {
  if (started) return;
  started = true;
  if (!cache?.data?.length) await refreshCotData('startup cache empty');
  schedulerLoop().catch(err => {
    console.error('[SCHEDULE] Scheduler failed:', err);
    setTimeout(() => schedulerLoop().catch(console.error), 60_000);
  });
}

export async function getReleaseSchedulePayload() {
  if (!releaseSchedule.length) await loadReleaseSchedule();
  return { ok: true, scheduler: schedulerStatus, schedule: releaseSchedule };
}

export function stopCotScheduler() {
  clearTimeout(schedulerTimer);
  clearTimeout(retryTimer);
}
