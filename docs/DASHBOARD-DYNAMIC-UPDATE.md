# Dynamic Market Intelligence Dashboard Update

Completed modules:

1. **Gold Risk Sentiment ribbon**
   - Shows Risk On, Risk Off, Neutral, Neutral+ or Neutral-.
   - Refreshes from `/api/dashboard/summary` every 60 seconds.
   - Trade idea badge is generated from the current Gold risk label.
   - Formula: RSS/JSON headline score + Gold price trend + COT positioning + volatility filter.

2. **USD Risk Sentiment**
   - Card title updated to `USD Risk Sentiment`.
   - Formula: USD headline score + DXY momentum filter.

3. **Volatility card**
   - Shows Gold/XAUUSD, EURUSD and GBPUSD.
   - Formula: `Composite = 12 × recent range% + annualized HV / 8`.

4. **Global Sessions**
   - Timings are editable in `data/session-config.json`.
   - Active session green row now has extra padding/margin.

5. **Currency Strength**
   - Backend dynamic calculation from major FX pair movement.
   - Endpoint: `/api/dashboard/summary`.

6. **SMC Bias**
   - Dynamic dropdown includes: EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD, Gold, Silver, Oil, BTC and ETH.
   - Formula: daily trend structure + COT index + RSS/JSON news score + volatility filter.

7. **High Probability card**
   - Automatically selects the most directional instrument from the same list using COT and daily bias score.

8. **Risk Warning**
   - Pulls the highest-risk headline from RSS/JSON feeds and creates a trade plan message.

9. **Watchlist Radar**
   - Includes all requested instruments and uses the same dynamic bias/volatility calculations.

10. **Reorderable cards**
   - Cards are drag-and-drop reorderable in the browser.
   - Saved per logged-in user in `data/dashboard-layouts.json`.

## Main files changed

- `server/services/dashboardService.js`
- `server/routes/dashboardRoutes.js`
- `server/index.js`
- `public/assets/js/dashboard-dynamic.js`
- `dist/assets/js/dashboard-dynamic.js`
- `dist/index.html`
- `index.html`
- `data/session-config.json`
- `data/dashboard-layouts.json`
- `.env.example`
- `README-SETUP.md`
- `src/pages/staticPages.js`

## API endpoints

- `GET /api/dashboard/summary`
- `POST /api/dashboard/refresh`
- `GET /api/dashboard/layout`
- `POST /api/dashboard/layout`

## News feed configuration

Edit `.env`:

```env
DASHBOARD_NEWS_FEEDS=https://www.forexlive.com/feed/,https://www.fxstreet.com/rss/news,https://www.dailyfx.com/feeds/market-news
```

Add any paid/private RSS or JSON endpoint here, including FinancialJuice if your account provides one. The module accepts RSS/XML and JSON.
