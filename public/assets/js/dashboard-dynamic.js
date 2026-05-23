(() => {
  const DEFAULT_LAYOUT = ['gold-risk','usd-risk','usd-index','volatility','sessions','currency-strength','smc-bias','high-probability','risk-warning','watchlist','pretrade'];
  let state = null;
  let layout = DEFAULT_LAYOUT.slice();
  let currentSmc = 'XAUUSD';
  let initializedToken = '';
  let refreshTimer = null;
  let saveTimer = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const pct = (value) => `${Number(value || 0) >= 0 ? '+' : ''}${Number(value || 0).toFixed(2)}%`;
  const num = (value, d = 2) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'N/A' : Number(value).toFixed(d);
  const statusClass = (value) => Number(value || 0) >= 0 ? 'stat-up' : 'stat-dn';
  const meterWidth = (v) => Math.max(5, Math.min(100, Number(v || 0) * 10));

  function injectCss() {
    if ($('#dynamic-dashboard-css')) return;
    const style = document.createElement('style');
    style.id = 'dynamic-dashboard-css';
    style.textContent = `
      .dynamic-dashboard-shell{padding:0 0 72px}.dash-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:0 0 18px}.dash-meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.dash-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;align-items:stretch}.dash-card{position:relative;min-height:150px;transition:.18s ease;cursor:default}.dash-card.dragging{opacity:.48;transform:scale(.985)}.dash-card.drag-over{outline:2px dashed var(--gold);outline-offset:5px}.dash-grid.drag-empty{outline:2px dashed rgba(245,184,69,.55);outline-offset:7px;border-radius:var(--radius2)}.dash-card.wide{grid-column:span 2}.dash-card.full{grid-column:span 4}.dash-card.compact-line{grid-column:3/span 2;min-height:82px;display:flex;justify-content:space-between;gap:18px;align-items:center;border-radius:999px;padding:14px 22px}.dash-card.compact-line h2{font-size:28px;line-height:1}.drag-handle{position:absolute;top:12px;right:14px;color:var(--muted2);font-size:14px;letter-spacing:.08em;border:1px solid var(--line);background:rgba(255,255,255,.06);border-radius:999px;width:34px;height:28px;display:inline-flex;align-items:center;justify-content:center;line-height:1;cursor:grab !important;z-index:3}.drag-handle:active{cursor:grabbing !important}.drag-handle:hover,.drag-handle:focus{color:var(--gold2);border-color:var(--line2);background:rgba(245,184,69,.12);outline:none}.dash-card.compact-line .drag-handle{top:50%;transform:translateY(-50%)}.dash-small{font-size:12px;color:var(--muted);font-weight:800}.dash-value{font-family:var(--display);font-size:44px;font-weight:950;line-height:1;margin-top:8px}.dash-sub{color:var(--muted);font-size:13px;line-height:1.45}.dash-source{font-size:11px;color:var(--muted2);margin-top:10px}.dash-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.vol-list{display:grid;gap:10px;margin-top:14px}.vol-row{display:grid;grid-template-columns:75px 1fr auto;gap:10px;align-items:center}.dashboard-select{border:1px solid var(--line);background:rgba(255,255,255,.055);color:var(--text);border-radius:12px;padding:8px 10px;font-weight:900;max-width:100%}.dashboard-select option{background:#0b101a;color:#fff}.smc-components{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.component-chip{border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:12px;padding:9px;text-align:center}.component-chip strong{display:block;color:var(--text)}.news-list{display:grid;gap:10px;margin-top:12px}.news-item{border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(255,255,255,.035)}.news-item a{color:var(--text);font-weight:900}.news-item span{display:block;margin-top:4px;color:var(--muted2);font-size:11px}.dash-table{min-width:980px}.layout-saving{color:var(--gold2);font-size:12px;font-weight:900}.session-row.open{background:rgba(34,197,94,.10);border-radius:12px;padding-left:10px;padding-right:10px;margin:4px 0}.session-status{padding-left:8px;min-width:58px;text-align:right}.reload-spin{animation:dashSpin .85s linear infinite}@keyframes dashSpin{to{transform:rotate(360deg)}}
      @media(max-width:1180px){.dash-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-card.compact-line,.dash-card.wide,.dash-card.full{grid-column:span 2}.dash-card.compact-line{border-radius:28px}}
      @media(max-width:680px){.dash-grid{grid-template-columns:1fr}.dash-card.compact-line,.dash-card.wide,.dash-card.full{grid-column:span 1}.dash-toolbar{display:block}.dash-meta{margin-top:12px}.smc-components{grid-template-columns:repeat(2,1fr)}.dash-value{font-size:36px}}
    `;
    document.head.appendChild(style);
  }

  function initCheck() {
    if (location.pathname !== '/dashboard') return;
    const staticDashboard = $('#marketStatus');
    const shell = $('.page-shell main');
    if (!staticDashboard || !shell) return;
    const token = `${location.pathname}:${staticDashboard.textContent}:${Date.now()}`;
    if (shell.dataset.dynamicDashboard === '1') return;
    initializedToken = token;
    shell.dataset.dynamicDashboard = '1';
    injectCss();
    shell.innerHTML = dashboardSkeleton();
    bindToolbar();
    loadDashboard();
  }

  function dashboardSkeleton() {
    return `
      <section class="page-header"><div class="container"><div class="tag"><span class="pulse"></span><span>Trader Command Center</span></div><h1>Market Intelligence Dashboard</h1><p class="lead">Live Gold risk sentiment, USD risk, volatility, sessions, dynamic SMC bias, COT-driven high probability setup, news risk and reorderable trader cards.</p></div></section>
      <section class="dynamic-dashboard-shell"><div class="container">
        <div class="dash-toolbar">
          <div class="dash-meta">
            <span class="badge badge-green" id="dashRefreshBadge">Loading live dashboard…</span>
            <span class="badge badge-blue">Refresh: 60s</span>
            <span class="layout-saving" id="layoutSaveStatus"></span>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-sm btn-ghost" id="dashboardRefreshBtn" type="button">↻ Refresh</button>
            <button class="btn btn-sm btn-ghost" id="dashboardResetLayout" type="button">Reset Layout</button>
          </div>
        </div>
        <div id="dashboardError" class="status-alert error" style="display:none"></div>
        <div class="dash-grid" id="dashboardGrid"><div class="panel full"><h3>Loading dashboard modules…</h3><p class="muted">Fetching price proxy, COT cache, RSS/JSON news aggregator and saved layout.</p></div></div>
      </div></section>`;
  }

  function bindToolbar() {
    $('#dashboardRefreshBtn')?.addEventListener('click', () => loadDashboard(true));
    $('#dashboardResetLayout')?.addEventListener('click', () => {
      layout = DEFAULT_LAYOUT.slice();
      renderCards();
      saveLayout();
    });
  }

  async function loadLayout() {
    try {
      const res = await fetch('/api/dashboard/layout', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Layout unavailable');
      const json = await res.json();
      if (Array.isArray(json.layout)) layout = normalizeLayout(json.layout);
    } catch {
      layout = normalizeLayout(JSON.parse(localStorage.getItem('vixtreetDashboardLayout') || 'null') || DEFAULT_LAYOUT);
    }
  }

  function normalizeLayout(items) {
    const allowed = new Set(DEFAULT_LAYOUT);
    const cleaned = Array.isArray(items) ? items.filter(id => allowed.has(id)) : [];
    DEFAULT_LAYOUT.forEach(id => { if (!cleaned.includes(id)) cleaned.push(id); });
    return cleaned;
  }

  async function loadDashboard(force = false) {
    const badge = $('#dashRefreshBadge');
    const btn = $('#dashboardRefreshBtn');
    if (btn) btn.classList.add('reload-spin');
    if (badge) badge.textContent = force ? 'Refreshing live data…' : 'Loading live data…';
    try {
      await loadLayout();
      const res = await fetch(`/api/dashboard/summary${force ? '?force=1' : ''}`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Dashboard API failed');
      state = json;
      renderCards();
      const err = $('#dashboardError');
      if (err) err.style.display = 'none';
      if (badge) badge.textContent = `Updated ${new Date(json.generatedAt).toLocaleTimeString()} • ${json.news?.ok ? 'Live RSS' : 'Fallback RSS'}`;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadDashboard(false), 60_000);
    } catch (err) {
      const box = $('#dashboardError');
      if (box) { box.textContent = `Dashboard error: ${err.message}`; box.style.display = 'block'; }
      if (badge) badge.textContent = 'Dashboard fallback/error';
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadDashboard(false), 60_000);
    } finally {
      if (btn) btn.classList.remove('reload-spin');
    }
  }

  function renderCards() {
    const grid = $('#dashboardGrid');
    if (!grid || !state) return;
    const cards = {
      'gold-risk': goldRiskCard,
      'usd-risk': usdRiskCard,
      'usd-index': usdIndexCard,
      'volatility': volatilityCard,
      'sessions': sessionsCard,
      'currency-strength': currencyStrengthCard,
      'smc-bias': smcBiasCard,
      'high-probability': highProbabilityCard,
      'risk-warning': riskWarningCard,
      'watchlist': watchlistCard,
      'pretrade': pretradeCard
    };
    grid.innerHTML = layout.map(id => cards[id]?.() || '').join('');
    bindDragDrop(grid);
    bindSmcSelect();
  }

  function dragHandle() { return '<button class="drag-handle" type="button" aria-label="Move dashboard card" title="Drag to move">⋮⋮</button>'; }
  function card(id, cls, html) { return `<article class="panel dash-card ${cls || ''}" data-card-id="${id}" draggable="false">${dragHandle()}${html}</article>`; }

  function goldRiskCard() {
    const g = state.goldRisk || {};
    const cls = g.label === 'Risk Off' || g.label === 'Neutral+' ? 'stat-up' : g.label === 'Risk On' || g.label === 'Neutral-' ? 'stat-dn' : '';
    return card('gold-risk', '', `<p class="tiny">Gold Risk Sentiment</p><div class="dash-value ${cls}">${esc(g.label || 'Neutral')}</div><span class="badge">${esc(g.tradeIdea || 'Wait confirmation')}</span><p class="dash-source">Formula: news + trend + COT + volatility</p>`);
  }

  function usdRiskCard() {
    const u = state.usdRisk || {};
    const positive = Number(u.score || 0) >= 10;
    const negative = Number(u.score || 0) <= -10;
    return card('usd-risk', '', `<p class="tiny">USD Risk Sentiment</p><div class="dash-value ${positive ? 'stat-up' : negative ? 'stat-dn' : ''}">${esc(u.label || 'USD Neutral')}</div><span class="badge">Score ${num(u.score, 1)}</span><p class="dash-source">${esc(u.formula || '')}</p>`);
  }

  function usdIndexCard() {
    const d = state.usdIndex || {};
    return card('usd-index', '', `<p class="tiny">USD Index Bias</p><div class="dash-value">${num(d.value, 2)}</div><span class="badge ${Number(d.changePct || 0) >= 0 ? 'badge-green' : 'badge-red'}">${pct(d.changePct)}</span><p class="dash-source">${esc(d.source || '')}</p>`);
  }

  function volatilityCard() {
    const rows = (state.volatility || []).map(v => `<div class="vol-row"><strong>${esc(v.asset)}</strong><div class="meter"><span style="width:${Math.min(100, Math.max(8, Number(v.score || 0) * 4))}%"></span></div><span class="badge ${v.label === 'High' ? 'badge-red' : v.label === 'Low' ? 'badge-green' : 'badge-blue'}">${esc(v.label)}</span></div>`).join('');
    return card('volatility', '', `<p class="tiny">Volatility</p><div class="vol-list">${rows}</div><p class="dash-source">Gold, EURUSD, GBPUSD calculated with existing HV/range formula.</p>`);
  }

  function sessionsCard() {
    const rows = (state.sessions || []).map(s => `<div class="session-row ${s.open ? 'open' : ''}"><span class="session-dot ${s.open ? 'open' : 'closed'}"></span><span class="session-name">${esc(s.name)}</span><span class="session-time">${esc(s.display)}</span><span class="session-status ${s.open ? 'open' : 'closed'}">${s.open ? 'OPEN' : 'CLOSED'}</span></div>`).join('');
    return card('sessions', 'wide', `<h3>Global Sessions</h3><p class="tiny">Edit timings: ${esc(state.sessionConfigFile || 'data/session-config.json')}</p><hr class="sep"/>${rows}`);
  }

  function currencyStrengthCard() {
    const rows = (state.currencyStrength || []).map(c => `<div class="str-item"><div class="str-currency">${esc(c.currency)}</div><div class="str-val ${c.status === 'strong' ? 'stat-up' : c.status === 'weak' ? 'stat-dn' : ''}">${num(c.value, 1)}</div><div class="meter"><span style="width:${meterWidth(c.value)}%"></span></div></div>`).join('');
    return card('currency-strength', 'wide', `<h3>Currency Strength</h3><p class="tiny">Dynamic backend meter from major FX pair changes.</p><hr class="sep"/><div class="strength-grid">${rows}</div>`);
  }

  function selectedBias() {
    const list = state.smcBiases || [];
    return list.find(b => b.key === currentSmc) || list[0] || {};
  }

  function bindSmcSelect() {
    const sel = $('#smcSymbolSelect');
    if (!sel) return;
    sel.value = currentSmc;
    sel.addEventListener('change', () => {
      currentSmc = sel.value;
      const target = $('[data-card-id="smc-bias"]');
      if (target) {
        target.outerHTML = smcBiasCard();
        bindDragDrop($('#dashboardGrid'));
        bindSmcSelect();
      }
    });
  }

  function smcBiasCard() {
    const b = selectedBias();
    const options = (state.assets || []).map(a => `<option value="${esc(a.key)}">${esc(a.label)}</option>`).join('');
    const comp = b.components || {};
    const components = ['trend','cot','news','volatility'].map(k => `<div class="component-chip"><span class="tiny">${k.toUpperCase()}</span><strong>${num(comp[k], 1)}</strong></div>`).join('');
    return card('smc-bias', 'wide', `<div class="dash-card-head"><div><span class="badge badge-blue">SMC Bias</span><h3 style="margin-top:12px">${esc(b.label || 'Select symbol')}</h3></div><select id="smcSymbolSelect" class="dashboard-select">${options}</select></div><div class="dash-value ${b.direction === 'bullish' ? 'stat-up' : b.direction === 'bearish' ? 'stat-dn' : ''}" style="font-size:34px">${esc(b.bias || 'Neutral')}</div><p class="muted">${esc(b.plan || '')}</p><div class="smc-components">${components}</div><p class="dash-source">${esc(b.method || '')}</p>`);
  }

  function highProbabilityCard() {
    const h = state.highProbability || {};
    return card('high-probability', '', `<span class="badge badge-green">High Probability</span><h3 style="margin-top:12px">${esc(h.label || 'Waiting')}</h3><div class="dash-value ${/BUY/i.test(h.direction || '') ? 'stat-up' : /SELL/i.test(h.direction || '') ? 'stat-dn' : ''}" style="font-size:31px">${esc(h.direction || 'Wait')}</div><p class="muted">${esc(h.reason || '')}</p><hr class="sep"/><div class="stat-row"><span>Plan</span><strong>${esc(h.plan || '')}</strong></div>`);
  }

  function riskWarningCard() {
    const r = state.riskWarning || {};
    const link = r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title || 'No headline');
    return card('risk-warning', '', `<span class="badge ${r.level === 'High Risk' ? 'badge-red' : ''}">${esc(r.level || 'Risk Warning')}</span><h3 style="margin-top:12px">Latest News Risk</h3><p class="muted">${link}</p><p class="dash-source">${esc(r.source || '')}</p><hr class="sep"/><p class="muted"><strong>${esc(r.message || '')}</strong></p><p class="muted">${esc(r.plan || '')}</p>`);
  }

  function watchlistCard() {
    const rows = (state.watchlist || []).map(w => `<tr><td><strong>${esc(w.key)}</strong><br/><span class="tiny">${esc(w.symbol)}</span></td><td class="${w.score >= 18 ? 'stat-up' : w.score <= -18 ? 'stat-dn' : ''}">${esc(w.trend)}</td><td>${esc(w.volatility)}</td><td>${esc(w.plan)}</td></tr>`).join('');
    return card('watchlist', 'full', `<h3>Watchlist Radar</h3><p class="tiny">7 major pairs + Gold, Silver, Oil, BTC, ETH. Dynamic trend, volatility, COT/news plan.</p><div class="table-wrap" style="margin-top:15px"><table class="dash-table"><thead><tr><th>Symbol</th><th>Bias/Trend</th><th>Volatility</th><th>Plan</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }

  function pretradeCard() {
    return card('pretrade', '', `<h3>Pre-Trade Checklist</h3><div class="checklist" style="margin-top:15px"><label class="checkline"><input type="checkbox"/> Higher-timeframe direction is clear.</label><label class="checkline"><input type="checkbox"/> Liquidity target is visible.</label><label class="checkline"><input type="checkbox"/> Entry model is defined before execution.</label><label class="checkline"><input type="checkbox"/> Risk is below daily limit.</label><label class="checkline"><input type="checkbox"/> No high-impact news conflict.</label></div>`);
  }

  function bindDragDrop(grid) {
    if (!grid) return;
    let dragged = null;

    const clearDragUI = () => {
      grid.classList.remove('drag-empty');
      $$('.dash-card.drag-over', grid).forEach(el => el.classList.remove('drag-over'));
    };

    const placeDragged = (event) => {
      if (!dragged) return;
      const targetCard = event.target.closest?.('.dash-card');
      
      if (targetCard && targetCard !== dragged) {
        const allCards = $$('.dash-card', grid);
        const draggedIndex = allCards.indexOf(dragged);
        const targetIndex = allCards.indexOf(targetCard);
        
        if (draggedIndex < targetIndex) {
          grid.insertBefore(dragged, targetCard.nextSibling);
        } else {
          grid.insertBefore(dragged, targetCard);
        }
      } else if (event.target === grid || grid.classList.contains('drag-empty')) {
        grid.appendChild(dragged);
      }
      syncLayoutFromDom();
    };

    $$('.dash-card', grid).forEach(cardEl => {
      const handle = $('.drag-handle', cardEl);
      if (!handle) return;
      
      handle.addEventListener('mousedown', () => {
        cardEl.draggable = true;
      });
      handle.addEventListener('mouseup', () => {
        cardEl.draggable = false;
      });

      cardEl.addEventListener('dragstart', (e) => {
        dragged = cardEl;
        cardEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardEl.dataset.cardId || '');
      });

      cardEl.addEventListener('dragend', () => {
        clearDragUI();
        cardEl.classList.remove('dragging');
        cardEl.draggable = false;
        dragged = null;
      });
    });

    grid.ondragover = (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDragUI();
      const targetCard = e.target.closest?.('.dash-card');
      if (targetCard && targetCard !== dragged) targetCard.classList.add('drag-over');
      else grid.classList.add('drag-empty');
    };

    grid.ondragleave = (e) => {
      if (!grid.contains(e.relatedTarget)) clearDragUI();
    };

    grid.ondrop = (e) => {
      if (!dragged) return;
      e.preventDefault();
      clearDragUI();
      placeDragged(e);
    };
  }

  function syncLayoutFromDom() {
    const ids = $$('.dash-card', $('#dashboardGrid')).map(el => el.dataset.cardId).filter(Boolean);
    layout = normalizeLayout(ids);
    localStorage.setItem('vixtreetDashboardLayout', JSON.stringify(layout));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLayout, 350);
  }

  async function saveLayout() {
    const status = $('#layoutSaveStatus');
    if (status) status.textContent = 'Saving layout…';
    try {
      const res = await fetch('/api/dashboard/layout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout })
      });
      if (!res.ok) throw new Error('Backend save failed');
      if (status) status.textContent = 'Layout saved';
    } catch {
      localStorage.setItem('vixtreetDashboardLayout', JSON.stringify(layout));
      if (status) status.textContent = 'Layout saved locally';
    }
    setTimeout(() => { const status2 = $('#layoutSaveStatus'); if (status2) status2.textContent = ''; }, 1800);
  }

  window.VixtreetDynamicDashboard = { initCheck, loadDashboard };
  const observer = new MutationObserver(() => initCheck());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => setTimeout(initCheck, 80));
  document.addEventListener('click', () => setTimeout(initCheck, 120), true);
  setInterval(initCheck, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCheck); else initCheck();
})();