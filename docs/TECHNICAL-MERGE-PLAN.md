# Technical Merge Plan

## 1. Tech stack of both websites

### First website: `vixtreet-cot-dynamic-v2-fixed.zip`

- Node.js 18+ backend.
- No external npm dependencies.
- Main file: `server.js`.
- COT page: `public/tools/cot-data.html`.
- Data folder: `data/` for COT cache and update state.
- Dynamic official CFTC source: CFTC Public Reporting Environment Legacy Futures Only CSV.
- Dynamic logic: CSV parsing, COT calculations, 26-week Commercial Net COT Index, release schedule parsing, cron-like scheduler, retry logic, manual refresh route.

### Second website: `profile-trading-elite-secure-upload-ready.zip`

- Static HTML/CSS/JavaScript frontend.
- PHP backend for auth and market-price proxy.
- JSON file database: `data/users.json`.
- Pages: home, dashboard, live terminal, tools directory, 18 tool pages, COT dashboard, education, blog, about, contact.
- Styling: dark premium gold/cyan trading theme in `assets/css/style.css`.
- Existing COT page in the second site used packaged/static JSON; this was replaced by the dynamic COT backend from the first site.

## 2. Files/pages merged

- First website COT logic was migrated into `server/services/cotService.js`.
- First website COT API routes were recreated in Express:
  - `GET /api/cot`
  - `GET /api/cot/status`
  - `GET /api/cot/release-schedule`
  - `POST /api/cot/refresh`
- Second website pages were moved into React SPA routes:
  - `/`
  - `/dashboard`
  - `/live`
  - `/tools`
  - `/tools/:slug`
  - `/cot`
  - `/education`
  - `/blog`
  - `/about`
  - `/contact`
  - `/login`
  - `/signup`
  - `/verify-email`
- Second website calculators/formulas were preserved through the migrated JavaScript calculator functions in `public/assets/js/legacy-main.js`.
- Second website auth was migrated from PHP to `server/routes/authRoutes.js` and `server/services/userStore.js`.
- Second website PHP market proxy was migrated to `server/routes/marketPrices.js`.

## 3. PHP/Node.js/React handling

- PHP files are no longer required at runtime.
- PHP auth functions were rewritten in Node.js:
  - signup
  - login
  - email verification
  - captcha
  - logout
  - protected dashboard check
- PHP JSON user database was retained as `data/users.json` to avoid unnecessary SQL/database bugs.
- PHP market-price endpoint was rewritten as a Node route.
- React handles routing and page rendering.
- Protected dashboard access uses the Node auth API.
- COT frontend was rebuilt as a React page while preserving the first site's data fields, table structure, filters, calculations, manual refresh, and chart drawer concept.

## 4. CSS/JS conflict avoidance

- The second website theme is the only global visual theme.
- The first website's standalone page CSS was not imported globally.
- New COT styles use specific class names such as `cot-controls`, `cot-table`, `chart-drawer`, and `index-pill`.
- All routes are React routes, so no `.php` and `.html` route conflicts remain.
- Backend API routes are grouped under `/api/*`.
- Static assets are served under `/assets/*`.
- Old PHP endpoint paths are only kept as compatibility aliases where useful, such as `/api/market-prices.php`.

## 5. COT dynamic functionality preservation

- Official CFTC CSV source remains live and dynamic.
- CSV parser, header normalization, market classification, Commercial Net, weekly net change, 26-week high/low, trend, and COT Index calculations were preserved.
- Scheduler reads the official CFTC release schedule and auto-refreshes one hour after release.
- Retry logic is preserved for network timeout, failed fetch, or stale report date.
- Manual refresh route is preserved through `POST /api/cot/refresh`.
- Frontend still refreshes COT data every 10 minutes while the page is open.
