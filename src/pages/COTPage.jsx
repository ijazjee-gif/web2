import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const fmt = n => (n === null || n === undefined || Number.isNaN(Number(n))) ? 'N/A' : Number(n).toLocaleString('en-US');
const pct = n => (n === null || n === undefined || Number.isNaN(Number(n))) ? 'N/A' : `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
const signedClass = v => (v === null || v === undefined || Number.isNaN(Number(v))) ? 'muted' : Number(v) < 0 ? 'red' : Number(v) > 0 ? 'green' : 'muted';
const indexLevel = v => Number(v) >= 75 ? 'high' : Number(v) <= 25 ? 'low' : 'mid';
const indexClass = v => Number(v) >= 75 ? 'index-high' : Number(v) <= 25 ? 'index-low' : 'index-mid';
const trendIcon = t => t === 'up' ? '↑' : t === 'down' ? '↓' : '↔';
const trendClass = t => t === 'up' ? 'trend up' : t === 'down' ? 'trend down' : 'trend flat';

export default function COTPage() {
  const [cotData, setCotData] = useState([]);
  const [meta, setMeta] = useState({});
  const [scheduler, setScheduler] = useState({});
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [idx, setIdx] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const canvasRef = useRef(null);

  const loadCot = useCallback(async () => {
    try {
      const res = await fetch('/api/cot', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
      const payload = await res.json();
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setCotData(rows);
      setMeta(payload.meta || {});
      setScheduler(payload.status?.scheduler || {});
    } catch (err) {
      console.error(err);
      setCotData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCot();
    const timer = setInterval(loadCot, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [loadCot]);

  const categories = useMemo(() => [...new Set(cotData.map(r => r.cat).filter(Boolean))], [cotData]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cotData.filter(row => {
      const matchSearch = !q || `${row.market} ${row.code} ${row.cat} ${row.rawMarket || ''}`.toLowerCase().includes(q);
      const matchCat = cat === 'all' || row.cat === cat;
      const matchIdx = idx === 'all' || indexLevel(row.index) === idx;
      return matchSearch && matchCat && matchIdx;
    });
  }, [cotData, query, cat, idx]);

  function reset() { setQuery(''); setCat('all'); setIdx('all'); }

  useEffect(() => {
    if (!selected || !canvasRef.current) return;
    const row = selected;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '14px Inter, Arial';
    ctx.fillStyle = '#f6f8ff';
    ctx.fillText(`${row.market} - Commercial Net 26W Range`, 24, 30);
    const min = Number(row.lowNet26), max = Number(row.highNet26), cur = Number(row.net);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(cur) || min === max) return;
    const x0 = 80, x1 = w - 80, y = h / 2 + 25;
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    const curX = x0 + (cur - min) / (max - min) * (x1 - x0);
    ctx.strokeStyle = '#f5b845'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(curX, y); ctx.stroke();
    ctx.fillStyle = '#55d6ff'; ctx.beginPath(); ctx.arc(curX, y, 13, 0, Math.PI * 2); ctx.fill();
  }, [selected]);

  const highlightPanelItems = useMemo(() => {
    const targets = [
      { label: 'GOLD', keys: ['gold'] },
      { label: 'DOLLAR INDEX', keys: ['dollar index', 'usdx', 'dxy'] },
      { label: 'EURO FX', keys: ['euro fx', 'eurusd', 'euro'] },
      { label: 'BRITISH POUND', keys: ['british pound', 'gbpusd', 'pound'] }
    ];

    return targets.map(target => {
      const found = cotData.find(r => 
        target.keys.some(k => r.market?.toLowerCase().includes(k))
      );
      return {
        label: target.label,
        index: found ? found.index : null
      };
    });
  }, [cotData]);

  const report = meta.reportDateFormatted || meta.reportDate || '—';
  const last = meta.lastUpdateFormatted || meta.lastUpdateAt || '—';
  const next = scheduler.nextAutoUpdateAtSite || scheduler.nextAutoUpdateAtEastern || scheduler.nextAutoUpdateAt || '—';

  return (
    <main>
      <section className="page-header">
        <div className="container hero-grid">
          <div>
            <div className="tag"><span className="pulse" /><span>Dynamic COT Desk</span></div>
            <h1>Live COT Data, COT Report &amp; COT Index</h1>
            <p className="lead">Official CFTC Commitments of Traders data, commercial net positioning, 26-week COT Index, weekly change, filters and range chart. The logic is migrated from the first website; the interface uses the second website theme.</p>
          </div>
          <div className="panel glow">
            <div className="terminal-top"><span /><span /><span /></div>
            {highlightPanelItems.map((item, i) => (
              <div className="terminal-row" key={i}>
                <span>{item.label}</span>
                {item.index !== null ? (
                  <strong className={item.index >= 75 ? 'green' : item.index <= 25 ? 'red' : ''}>
                    COT {fmt(item.index)}%
                  </strong>
                ) : (
                  <strong className="muted">{loading ? 'Loading...' : 'N/A'}</strong>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="container grid-4">
          <div className="panel"><p className="tiny">Report week</p><h3>{report}</h3></div>
          <div className="panel"><p className="tiny">Last update</p><h3>{last}</h3></div>
          <div className="panel"><p className="tiny">Next auto update</p><h3>{next}</h3></div>
          <div className="panel"><p className="tiny">Markets loaded</p><h3>{cotData.length}</h3></div>
        </div>
      </section>

      <section className="section tight">
        <div className="container">
          <div className="panel">
            <div className="section-head">
              <div><span className="badge">Filters</span><h2 className="section-title">Market Positioning Table</h2></div>
              <p className="muted">Click any row to open the 26-week commercial net range chart.</p>
            </div>
            <div className="cot-controls">
              <label>Search market<input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search EUR, Gold, Bitcoin..." /></label>
              <label>Category<select className="input" value={cat} onChange={e => setCat(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option value={c} key={c}>{c}</option>)}</select></label>
              <label>COT Index<select className="input" value={idx} onChange={e => setIdx(e.target.value)}><option value="all">All zones</option><option value="high">High / 75+</option><option value="mid">Middle</option><option value="low">Low / 25-</option></select></label>
              <button className="btn btn-ghost" type="button" onClick={reset}>Reset</button>
            </div>
          </div>
          <div className="table-wrap cot-table" style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Price</th>
                  <th>Trend</th>
                  <th>Commercial <br/><small style={{ opacity: 0.5, fontSize: '10px' }}>(L / S)</small></th>
                  <th>Commercial Net</th>
                  <th>Weekly Change</th>
                  <th>Large Spec <br/><small style={{ opacity: 0.5, fontSize: '10px' }}>(L / S)</small></th>
                  <th>Small Spec <br/><small style={{ opacity: 0.5, fontSize: '10px' }}>(L / S)</small></th>
                  <th>Open Interest</th>
                  <th>26W Range <br/><small style={{ opacity: 0.5, fontSize: '10px' }}>(H / L)</small></th>
                  <th>COT Index</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? (
                  <tr><td colSpan="11">{loading ? 'Loading dynamic COT data...' : 'No matching market found.'}</td></tr>
                ) : (
                  renderGroupedRows(rows, setSelected)
                )}
              </tbody>
            </table>
          </div>
          <div className={`chart-drawer ${selected ? 'is-open' : ''}`}>
            {selected && <div className="panel glow">
              <div className="section-head"><div><span className="badge">Market Detail</span><h2 className="section-title">{selected.market} ({selected.code || 'CFTC'})</h2></div><button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button></div>
              <canvas className="chart-canvas" ref={canvasRef} width="900" height="300" />
            </div>}
          </div>
        </div>
      </section>
    </main>
  );
}

function renderGroupedRows(rows, setSelected) {
  const out = [];
  let currentCat = '';
  rows.forEach(row => {
    if (row.cat !== currentCat) {
      currentCat = row.cat;
      out.push(<tr className="category" key={`cat-${currentCat}`}><td colSpan="11" style={{ fontWeight: 'bold', letterSpacing: '0.5px' }}>{currentCat}</td></tr>);
    }
    out.push(
      <tr className="data-row" tabIndex="0" key={`${row.code}-${row.market}`} onClick={() => setSelected(row)} onKeyDown={e => { if (e.key === 'Enter') setSelected(row); }}>
        {/* 1. Market */}
        <td><span className="market-name">{row.market}</span><span className="sub">{row.code || 'CFTC'} futures</span></td>
        
        {/* 2. Price */}
        <td className="muted">{pct(row.price)}</td>
        
        {/* 3. Trend */}
        <td><span className={trendClass(row.trend)}>{trendIcon(row.trend)}</span></td>
        
        {/* 4. Commercial Long / Short stacked */}
        <td>
          <div style={{ fontWeight: '500' }}>{fmt(row.cLong)}</div>
          <div className="muted" style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{fmt(row.cShort)}</div>
        </td>
        
        {/* 5. Commercial Net */}
        <td className={signedClass(row.net)} style={{ fontWeight: '600' }}>{fmt(row.net)}</td>
        
        {/* 6. Weekly Change */}
        <td className={signedClass(row.change)}>{fmt(row.change)}</td>
        
        {/* 7. Large Speculators stacked */}
        <td>
          <div style={{ fontWeight: '500' }}>{fmt(row.lLong)}</div>
          <div className="muted" style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{fmt(row.lShort)}</div>
        </td>
        
        {/* 8. Small Speculators stacked */}
        <td>
          <div style={{ fontWeight: '500' }}>{fmt(row.sLong)}</div>
          <div className="muted" style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{fmt(row.sShort)}</div>
        </td>
        
        {/* 9. Open Interest */}
        <td>{fmt(row.oi)}</td>
        
        {/* 10. 26W High / Low Extremes stacked */}
        <td>
          <div className="green" style={{ fontWeight: '500' }}>{fmt(row.highNet26)}</div>
          <div className="red" style={{ fontSize: '10px', opacity: 0.5, marginTop: '2px' }}>{fmt(row.lowNet26)}</div>
        </td>
        
        {/* 11. COT Index */}
        <td><span className={`index-pill ${indexClass(row.index)}`}>{fmt(row.index)}%</span></td>
      </tr>
    );
  });
  return out;
}