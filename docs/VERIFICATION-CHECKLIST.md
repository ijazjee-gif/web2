# Verification Checklist

## 1. Second website features work

- [ ] Home page opens at `/`.
- [ ] Dashboard route opens only after login.
- [ ] Login works with the migrated verified user.
- [ ] Signup creates a new user in `data/users.json`.
- [ ] Email verification works with SMTP or debug console code.
- [ ] Live Terminal route opens at `/live`.
- [ ] TradingView widget loads when internet access is available.
- [ ] Tools directory opens at `/tools`.
- [ ] All 18 calculator pages open under `/tools/:slug`.
- [ ] Calculator buttons produce results.
- [ ] Contact form validates fields and opens mailto fallback.
- [ ] Market price API returns JSON from `/api/market-prices` when server internet is available.

## 2. COT page loads dynamically and works fully

- [ ] `/cot` loads the React COT page.
- [ ] `GET /api/cot` returns live/cache JSON from the Node backend.
- [ ] Search filter works.
- [ ] Category filter works.
- [ ] COT Index filter works.
- [ ] Table rows show Commercial Long, Commercial Short, Commercial Net, Weekly Change, Open Interest, 26W High/Low, and COT Index.
- [ ] Clicking a row opens the chart drawer.
- [ ] Manual refresh button calls `POST /api/cot/refresh`.
- [ ] Scheduler status appears in `/api/cot/status`.

## 3. Styling matches second website

- [ ] Dark premium gold/cyan theme is used across pages.
- [ ] Navbar, cards, panels, buttons, badges, background, typography, and footer match the second site.
- [ ] COT page feels native to the second site while retaining the COT table/layout logic.

## 4. Mobile responsiveness is preserved

- [ ] Navbar collapses on mobile.
- [ ] Cards stack correctly.
- [ ] COT filters stack on mobile.
- [ ] Wide tables scroll horizontally instead of breaking layout.
- [ ] Tool pages remain usable on small screens.

## 5. No route/CSS/JS conflicts

- [ ] No PHP runtime is required.
- [ ] No `.php` route is needed for frontend pages.
- [ ] React routes work after page refresh in production.
- [ ] API routes are isolated under `/api/*`.
- [ ] Old static COT JSON does not replace dynamic CFTC COT data.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
