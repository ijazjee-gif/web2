# Vixtreet + Profile Trading Elite — Merged Node.js + React.js Website

This project merges:

1. `vixtreet-cot-dynamic-v2-fixed.zip` — dynamic COT Node server/page.
2. `profile-trading-elite-secure-upload-ready.zip` — premium trading website, tools, dashboard, auth, uploads/security style.

The final project is a Node.js + React.js stack:

- Frontend: React + Vite SPA with route-based pages.
- Backend: Express.js API server.
- Auth/database: migrated from PHP JSON auth to Node JSON auth in `data/users.json`.
- COT: migrated from the first website into `server/services/cotService.js` and exposed through `/api/cot` routes.
- Market prices: migrated from PHP `api/market-prices.php` to Node `/api/market-prices`.

## Local setup

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

For development with Vite + Node together:

```bash
npm install
npm run dev
```

## Default migrated verified account

The existing pre-verified account from the second website is kept in `data/users.json`:

```text
Username: bonapapa394
Password: AdobePh55393#ho
```

Change or remove this account before public production launch.

## Production setup

1. Upload the full project folder to your server.
2. Run `npm install`.
3. Create `.env` from `.env.example`.
4. Set `SESSION_SECRET` to a long random value.
5. Set `SITE_URL` to the real domain.
6. Configure SMTP fields if you want real email verification delivery.
7. Run `npm run build`.
8. Run with a process manager:

```bash
npm start
# or
pm2 start server/index.js --name vixtreet-merged
```

## COT auto-update logic

The COT backend uses the official CFTC Public Reporting Environment Legacy Futures Only CSV:

```text
https://publicreporting.cftc.gov/api/views/6dca-aqww/rows.csv?accessType=DOWNLOAD&bom=true&format=true
```

It also checks the CFTC release schedule page and auto-refreshes one hour after the scheduled release time. If the official release schedule cannot be fetched, the backend uses a Friday fallback schedule and retries after failures or stale report dates.

Important COT routes:

```text
GET  /api/cot
GET  /api/cot/status
GET  /api/cot/release-schedule
POST /api/cot/refresh
```

## Auth routes

```text
GET  /api/auth/captcha
GET  /api/auth/me
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/verify-email
POST /api/auth/resend-code
POST /api/auth/logout
```

## Market price route

```text
GET /api/market-prices
```

The old PHP route is also aliased for compatibility:

```text
GET /api/market-prices.php
```

## Notes

- No PHP runtime is required anymore.
- `data/users.json` is the migrated database file.
- If you want SQL later, migrate the same user fields shown in `database/README.md`.
- The second website theme is the base theme throughout the React app.
- The first website COT CSS was not copied globally to avoid conflicts; only functionality and layout concepts were ported into the second website visual system.

## Dynamic Dashboard Intelligence Update

The dashboard now has a backend intelligence layer at:

- `GET /api/dashboard/summary` — live/cached dashboard payload refreshed every 60 seconds.
- `POST /api/dashboard/refresh` — force refresh.
- `GET /api/dashboard/layout` — logged-in user's saved card order.
- `POST /api/dashboard/layout` — saves logged-in user's reordered cards to `data/dashboard-layouts.json`.

### What changed on `/dashboard`

- Card 1 is now a compact Gold Risk Sentiment line/ribbon. It uses RSS/JSON headline scoring, Gold price trend, COT positioning and volatility filter. The badge under it shows the trade idea.
- Card 2 title is now `USD Risk Sentiment`.
- Volatility card now shows Gold, EURUSD and GBPUSD using the backend HV/range formula.
- Sessions are read from `data/session-config.json`. Edit this file to change Sydney/Tokyo/London/New York timing.
- Currency strength is dynamically calculated from major FX pair changes.
- SMC Bias is dynamic with a dropdown for EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD, Gold, Silver, Oil, BTC and ETH.
- High Probability card selects the most directional symbol from the same list using COT + daily bias scoring.
- Risk Warning pulls the highest-risk headline from the RSS/JSON aggregator and creates a trader message/plan.
- Watchlist Radar includes all requested symbols and updates from the same calculation module.
- Cards are drag-and-drop reorderable. Order is saved per user in `data/dashboard-layouts.json`.

### News/RSS/JSON feeds

Configure feeds in `.env`:

```env
DASHBOARD_NEWS_FEEDS=https://www.forexlive.com/feed/,https://www.fxstreet.com/rss/news,https://www.dailyfx.com/feeds/market-news
```

If FinancialJuice or another provider gives you a private RSS/JSON endpoint or API URL, add it to the same comma-separated variable. The backend aggregator accepts RSS/XML or JSON. If the server has no internet, the dashboard uses cached/fallback data and clearly reports fallback RSS status.

### API / market data source

The dashboard uses the existing server-side Yahoo Finance chart proxy style for price snapshots. The code is in `server/services/dashboardService.js`. For a paid provider, replace/add fetch logic in `fetchMarketSnapshots()` or add provider credentials through `.env`.

### Session timing edit location

Edit:

```txt
data/session-config.json
```

The active session green box has added padding/margins so it no longer sticks to the row text.
