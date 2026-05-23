const $ = (id) => document.getElementById(id);
const money = (n, c='$') => `${c}${Number(n).toLocaleString(undefined,{maximumFractionDigits:2,minimumFractionDigits:2})}`;
const num = (id) => parseFloat(($(id)||{}).value);
const val = (id) => ($(id)||{}).value;
const valid = (...xs) => xs.every(x => Number.isFinite(x));
function showBox(id, main, sub='') { const box=$(id); if(!box) return; box.style.display='block'; const m=box.querySelector('.result-main'); const s=box.querySelector('.result-sub'); if(m) m.innerHTML=main; if(s) s.innerHTML=sub; }
function warn(id,msg='Please enter valid numbers.') { showBox(id, 'Check Inputs', msg); }
document.addEventListener('DOMContentLoaded', () => {
  setupMobileNav();
  const path = location.pathname.split('/').pop() || 'index.html'; document.querySelectorAll('.nav-links a').forEach(a=>{ const href=(a.getAttribute('href')||'').split('/').pop(); if(href===path) a.classList.add('active') });
  document.querySelectorAll('#year').forEach(x=>x.textContent=new Date().getFullYear());
  updateSessions(); setInterval(updateSessions, 60000); loadLiveMarketPulse(); setInterval(loadLiveMarketPulse, 60000); setupTabs(); setupContact(); setupToolCalculators(); loadCOTDashboard();
});
function setupMobileNav(){
  const toggle=$('mobileToggle'), nav=$('navLinks');
  if(toggle&&nav){
    toggle.addEventListener('click',()=>{ const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', open?'true':'false'); if(!open) document.querySelectorAll('.nav-dropdown.open').forEach(d=>d.classList.remove('open')); });
  }
  document.querySelectorAll('.nav-dropdown > .nav-drop-link').forEach(link=>{
    link.addEventListener('click', e=>{
      if(window.matchMedia('(max-width:1040px)').matches){
        e.preventDefault();
        const box=link.closest('.nav-dropdown');
        document.querySelectorAll('.nav-dropdown.open').forEach(d=>{ if(d!==box) d.classList.remove('open'); });
        box?.classList.toggle('open');
      }
    });
  });
}
function setPulseStatus(text, ok=true){ const s=$('marketPulseStatus'); if(s){ s.textContent=text; s.className=`tiny ${ok?'stat-up':'stat-dn'}`; } }
function formatPulsePrice(item){ if(!item||!Number.isFinite(Number(item.price))) return '—'; const price=Number(item.price); const prefix=item.prefix||''; const decimals=Number.isFinite(Number(item.decimals))?Number(item.decimals):4; const formatted=prefix ? `${prefix}${price.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}` : price.toFixed(decimals); const arrow=item.direction==='down'?'▼':item.direction==='up'?'▲':'•'; return `${formatted} ${arrow}`; }
function renderPulseItem(id,item){ const el=$(id); if(!el) return; el.className=`stat-val ${item?.direction==='down'?'stat-dn':item?.direction==='up'?'stat-up':'stat-neutral'}`; el.textContent=formatPulsePrice(item); }
async function loadLiveMarketPulse(){
  if(!$('heroGold')) return;
  try{
    const res=await fetch('/api/market-prices',{cache:'no-store'});
    if(!res.ok) throw new Error('Market feed unavailable');
    const data=await res.json();
    const items=data.items||{};
    renderPulseItem('heroGold',items.gold); renderPulseItem('heroEur',items.eurusd); renderPulseItem('heroGbp',items.gbpusd); renderPulseItem('heroJpy',items.usdjpy); renderPulseItem('heroOil',items.oil);
    const stamp=data.timestamp?new Date(data.timestamp*1000):new Date();
    setPulseStatus(`Live prices updated: ${stamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`, true);
  }catch(err){
    setPulseStatus('Live price feed unavailable. Check server internet/API access.', false);
  }
}
function updateSessions(){
  const map=[['Sydney',21,6],['Tokyo',0,9],['London',8,17],['New York',13,22]]; const d=new Date(); const h=d.getUTCHours()+d.getUTCMinutes()/60; const day=d.getUTCDay(); const weekday=day>0 && day<6;
  map.forEach(([name,start,end])=>{ const open = weekday && (start<end ? h>=start && h<end : h>=start || h<end); const key=name.toLowerCase().replace(/ /g,''); const row=$(`${key}Session`); if(row){ row.classList.toggle('open', open); row.classList.toggle('closed', !open); row.querySelector('.session-dot')?.classList.toggle('open',open); row.querySelector('.session-dot')?.classList.toggle('closed',!open); const st=row.querySelector('.session-status'); if(st){ st.textContent=open?'OPEN':'CLOSED'; st.className=`session-status ${open?'open':'closed'}`; } }});
  const clock=$('utcClock'); if(clock) clock.textContent=d.toUTCString().replace('GMT','UTC'); const status=$('marketStatus'); if(status){ status.textContent=weekday?'OPEN':'CLOSED'; status.className=weekday?'stat-up':'stat-dn'; }
}
function setupTabs(){ document.querySelectorAll('[data-tab-target]').forEach(btn=>btn.addEventListener('click',()=>{ const group=btn.closest('.tab-group')||document; group.querySelectorAll('[data-tab-target]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); group.querySelectorAll('[data-tab-panel]').forEach(p=>p.style.display='none'); const panel=group.querySelector(btn.dataset.tabTarget); if(panel) panel.style.display='block'; })); }
function setupContact(){ const form=$('contactForm'); if(!form) return; form.addEventListener('submit', e=>{ e.preventDefault(); const name=val('c_name'), email=val('c_email'), subject=val('c_subject'), msg=val('c_message'); const status=$('formStatus'); if(!name||!email||!subject||!msg){ status.style.display='block'; status.textContent='Please fill all fields before sending.'; status.className='note form-status badge-red'; return; } const body=encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${msg}`); location.href=`mailto:support@yourdomain.com?subject=${encodeURIComponent(subject)}&body=${body}`; status.style.display='block'; status.textContent='Your email app has been opened. For live form submission, connect this form to PHP/API backend.'; status.className='note form-status badge-green'; }); }
function setupToolCalculators(){
  const toolActions = {
    'position-size-calculator':'calcPosition',
    'pip-value-calculator':'calcPipValue',
    'risk-reward-calculator':'calcRR',
    'compounding-calculator':'calcCompound',
    'drawdown-recovery-calculator':'calcDrawdown',
    'fibonacci-calculator':'calcFib',
    'atr-stop-loss-tool':'calcATR',
    'margin-calculator':'calcMargin',
    'pivot-point-calculator':'calcPivots',
    'profit-loss-calculator':'calcPL',
    'expectancy-calculator':'calcExpectancy',
    'swap-calculator':'calcSwap',
    'lot-converter':'calcLotConverter',
    'break-even-win-rate-calculator':'calcBreakeven',
    'spread-cost-calculator':'calcSpread',
    'account-risk-guard':'calcRiskGuard',
    'news-impact-risk-tool':'calcNews',
    'trade-journal-scorer':'calcJournal'
  };
  document.querySelectorAll('.single-tool-panel input[type="number"]').forEach(input=>{ if(!input.getAttribute('step')) input.setAttribute('step','any'); });
  Object.entries(toolActions).forEach(([panelId, fnName])=>{
    const panel=$(panelId); if(!panel) return;
    const button=panel.querySelector('button.btn-primary');
    if(button){
      button.type='button';
      button.addEventListener('click', e=>{
        e.preventDefault();
        const fn=window[fnName];
        if(typeof fn==='function') fn();
      });
    }
    panel.querySelectorAll('input,select').forEach(field=>{
      field.addEventListener('keydown', e=>{
        if(e.key==='Enter' && button){ e.preventDefault(); button.click(); }
      });
    });
  });
}
function fmtNum(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:0}); }
function cotChangeLabel(current, previous){ const change=current-previous; return `${change>=0?'+':''}${fmtNum(change)}`; }
async function loadCOTDashboard(){
  const grid=$('cotMarketsGrid'); if(!grid) return;
  const fallback={last_update_date:'2026-05-15',report_positions_as_of:'2026-05-12',downloaded_at:'2026-05-20',source:'Local packaged COT dataset.',markets:[{market:'EUR Futures',status:'Improving',badge:'badge-green',long_interest:68,short_pressure:32,current_net:125000,previous_net:98000,institutional_bias:'Bullish improvement',positioning_note:'Net longs rising',trading_use:'Look for long setups after liquidity sweep'},{market:'Gold Futures',status:'Crowded Long',badge:'badge-blue',long_interest:74,short_pressure:26,current_net:184000,previous_net:171500,institutional_bias:'Bullish but crowded',positioning_note:'Long exposure elevated',trading_use:'Use pullbacks; avoid chasing tops'},{market:'JPY Futures',status:'Weak',badge:'badge-red',long_interest:29,short_pressure:71,current_net:-96000,previous_net:-104000,institutional_bias:'Bearish with squeeze risk',positioning_note:'Spec shorts remain heavy',trading_use:'Follow trend but monitor short squeeze risk'}]};
  let data=fallback;
  try{ const r=await fetch('/assets/data/cot-latest.json',{cache:'no-store'}); if(r.ok) data=await r.json(); }catch(e){}
  const set=(id,v)=>{ const el=$(id); if(el) el.textContent=v||'Not available'; };
  set('cotLastUpdate',data.last_update_date); set('cotPositionsDate',data.report_positions_as_of); set('cotDownloadedAt',data.downloaded_at);
  grid.innerHTML=(data.markets||[]).map(m=>`<div class="panel"><h3>${m.market}</h3><span class="badge ${m.badge||''}">${m.status||'Updated'}</span><div class="cot-bar-wrap"><div class="cot-bar-label"><span>Long Interest</span><span>${m.long_interest}%</span></div><div class="cot-track"><div class="cot-fill-long" style="width:${m.long_interest}%"></div></div></div><div class="cot-bar-wrap"><div class="cot-bar-label"><span>Short Pressure</span><span>${m.short_pressure}%</span></div><div class="cot-track"><div class="cot-fill-short" style="width:${m.short_pressure}%"></div></div></div><div class="cot-figure-grid"><div class="cot-figure-card"><div class="label">Current net</div><div class="value">${fmtNum(m.current_net)}</div></div><div class="cot-figure-card"><div class="label">Weekly change</div><div class="value">${cotChangeLabel(m.current_net,m.previous_net)}</div></div></div></div>`).join('');
  const quick=$('cotQuickFigures'); if(quick){ quick.innerHTML=(data.markets||[]).slice(0,4).map(m=>`<div class="cot-figure-card"><div class="label">${m.market}</div><div class="value">${fmtNum(m.current_net)}</div><div class="note">Change: ${cotChangeLabel(m.current_net,m.previous_net)}</div></div>`).join(''); }
  const body=$('cotTableBody'); if(body){ body.innerHTML=(data.markets||[]).map(m=>`<tr><td>${m.market}</td><td>${fmtNum(m.current_net)}</td><td>${fmtNum(m.previous_net)}</td><td>${cotChangeLabel(m.current_net,m.previous_net)}</td><td>${m.institutional_bias}</td><td>${m.trading_use}</td></tr>`).join(''); }
  const panel=$('cot-analyzer'); if(panel){ const btn=panel.querySelector('button.btn-primary'); if(btn) btn.addEventListener('click',e=>{ e.preventDefault(); calcCOT(); }); panel.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&btn){e.preventDefault();btn.click();} })); }
}
function calcPosition(){ const b=num('ps_balance'), r=num('ps_risk'), sl=num('ps_sl'); const type=val('ps_type'); if(!valid(b,r,sl)||b<=0||r<=0||sl<=0) return warn('ps_result'); const pip={major:10,jpy:9.1,gold:1,cross:7.5}[type]||10; const risk=b*r/100; const lots=risk/(sl*pip); showBox('ps_result', `${lots.toFixed(2)} lots`, `Risk: ${money(risk)} · Approx pip value/lot: ${money(pip)}`); }
function calcPipValue(){ const lot=num('pv_lot'); if(!valid(lot)||lot<=0) return warn('pv_result'); const pair=val('pv_pair'); const pip={major:10,jpy:9.1,gold:1,usdx:10,cross:7.5}[pair]||10; const v=lot*pip; showBox('pv_result', money(v), `Approx pip value for ${lot} lot`); }
function calcRR(){ const e=num('rr_entry'), sl=num('rr_sl'), tp=num('rr_tp'); if(!valid(e,sl,tp)||e===sl||e===tp) return warn('rr_result'); const risk=Math.abs(e-sl), reward=Math.abs(tp-e), rr=reward/risk, be=100/(1+rr); showBox('rr_result', `1 : ${rr.toFixed(2)}`, `Break-even win rate: ${be.toFixed(1)}%`); }
function calcCompound(){ const start=num('comp_start'), pct=num('comp_pct'), months=num('comp_months'); if(!valid(start,pct,months)||start<=0||months<0) return warn('comp_result'); const final=start*Math.pow(1+pct/100,months); showBox('comp_result', money(final), `Total gain: ${money(final-start)} (${((final/start-1)*100).toFixed(1)}%)`); }
function calcDrawdown(){ const dd=num('dd_pct'), bal=num('dd_bal'); if(!valid(dd,bal)||dd<0||dd>=100||bal<=0) return warn('dd_result'); const after=bal*(1-dd/100), rec=dd/(100-dd)*100; showBox('dd_result', `${rec.toFixed(2)}%`, `Balance after drawdown: ${money(after)} · Need ${money(bal-after)} recovery`); }
function calcFib(){ const high=num('fib_high'), low=num('fib_low'), dir=val('fib_dir'); if(!valid(high,low)||high<=low) return warn('fib_result'); const levels=[0.236,0.382,0.5,0.618,0.705,0.786]; const exts=[1.272,1.618,2]; const range=high-low; let html='<div class="result-box" style="display:block"><div class="result-main">Fibonacci Levels</div>'; levels.forEach(l=>{ const p=dir==='up'?high-range*l:low+range*l; html+=`<div class="stat-row"><span>${(l*100).toFixed(1)}%</span><strong>${p.toFixed(5)}</strong></div>`; }); exts.forEach(l=>{ const p=dir==='up'?high+range*(l-1):low-range*(l-1); html+=`<div class="stat-row"><span>Ext ${(l*100).toFixed(1)}%</span><strong>${p.toFixed(5)}</strong></div>`; }); html+='</div>'; const out=$('fib_result'); out.style.display='block'; out.innerHTML=html; }
function calcATR(){ const atr=num('atr_val'), mult=num('atr_mult'), entry=num('atr_entry'), pip=num('atr_pip'); if(!valid(atr,mult,entry,pip)||atr<=0||mult<=0||pip<=0) return warn('atr_result'); const dist=atr*mult*pip; const sl=val('atr_dir')==='buy'?entry-dist:entry+dist; showBox('atr_result', sl.toFixed(5), `${atr*mult} pips stop distance`); }
function calcMargin(){ const lots=num('mg_lots'), lev=num('mg_lev'), contract=num('mg_contract'), price=num('mg_price')||1; if(!valid(lots,lev,contract,price)||lots<=0||lev<=0) return warn('mg_result'); const m=lots*contract*price/lev; showBox('mg_result', money(m), `For ${lots} lots at 1:${lev} leverage`); }
function calcPivots(){ const h=num('piv_h'), l=num('piv_l'), c=num('piv_c'), method=val('piv_method'); if(!valid(h,l,c)||h<=l) return warn('piv_result'); const p=(h+l+c)/3; let rows=[]; if(method==='classic'){ rows=[['R3',h+2*(p-l)],['R2',p+(h-l)],['R1',2*p-l],['PP',p],['S1',2*p-h],['S2',p-(h-l)],['S3',l-2*(h-p)]]; } else if(method==='fibo'){ rows=[['R3',p+(h-l)*1.000],['R2',p+(h-l)*0.618],['R1',p+(h-l)*0.382],['PP',p],['S1',p-(h-l)*0.382],['S2',p-(h-l)*0.618],['S3',p-(h-l)*1.000]]; } else { rows=[['R4',c+(h-l)*1.1/2],['R3',c+(h-l)*1.1/4],['R2',c+(h-l)*1.1/6],['R1',c+(h-l)*1.1/12],['S1',c-(h-l)*1.1/12],['S2',c-(h-l)*1.1/6],['S3',c-(h-l)*1.1/4],['S4',c-(h-l)*1.1/2]]; } let html='<div class="result-box" style="display:block"><div class="result-main">Pivot Levels</div>'; rows.forEach(r=>html+=`<div class="stat-row"><span>${r[0]}</span><strong>${r[1].toFixed(5)}</strong></div>`); html+='</div>'; $('piv_result').style.display='block'; $('piv_result').innerHTML=html; }
function calcPL(){ const entry=num('pl_entry'), exit=num('pl_exit'), lots=num('pl_lots'), pip=num('pl_pip'), pipv=num('pl_pipv'); if(!valid(entry,exit,lots,pip,pipv)||lots<=0||pip<=0) return warn('pl_result'); const direction=val('pl_dir')==='buy'?1:-1; const pips=(exit-entry)/pip*direction; const profit=pips*pipv*lots; showBox('pl_result', money(profit), `${pips.toFixed(1)} pips ${profit>=0?'profit':'loss'}`); }
function calcExpectancy(){ const wr=num('ex_win'), aw=num('ex_avgwin'), al=num('ex_avgloss'); if(!valid(wr,aw,al)||wr<0||wr>100||aw<0||al<0) return warn('ex_result'); const exp=(wr/100)*aw-(1-wr/100)*al; const label=exp>0?'Positive edge':'Negative / weak edge'; showBox('ex_result', money(exp), `${label} per trade`); }
function calcSwap(){ const lots=num('sw_lots'), swap=num('sw_rate'), days=num('sw_days'), triple=$('sw_triple')?.checked?3:1; if(!valid(lots,swap,days)||lots<=0||days<0) return warn('sw_result'); const total=lots*swap*(days+triple-1); showBox('sw_result', money(total), `Estimated overnight financing for ${days} day(s)`); }
function calcLotConverter(){ const lots=num('lc_lots'), contract=num('lc_contract'); if(!valid(lots,contract)||lots<=0) return warn('lc_result'); const units=lots*contract; showBox('lc_result', units.toLocaleString(), `Base currency units · Micro lots: ${(lots*100).toFixed(0)}`); }
function calcBreakeven(){ const rr=num('be_rr'); if(!valid(rr)||rr<=0) return warn('be_result'); const win=100/(1+rr); showBox('be_result', `${win.toFixed(1)}%`, `Minimum win rate needed at 1:${rr.toFixed(2)} RR`); }
function calcSpread(){ const spread=num('sp_spread'), lots=num('sp_lots'), pipv=num('sp_pipv'); if(!valid(spread,lots,pipv)||spread<0||lots<=0) return warn('sp_result'); const cost=spread*lots*pipv; showBox('sp_result', money(cost), `Round-trip cost estimate before commission`); }
function calcRiskGuard(){ const bal=num('rg_balance'), risk=num('rg_risk'), losses=num('rg_losses'); if(!valid(bal,risk,losses)||bal<=0||risk<0||losses<0) return warn('rg_result'); let current=bal; for(let i=0;i<losses;i++) current*=1-risk/100; const dd=(1-current/bal)*100; showBox('rg_result', `${dd.toFixed(2)}% DD`, `After ${losses} losing trades: ${money(current)}`); }
function calcNews(){ const bal=num('nw_balance'), risk=num('nw_risk'), stop=num('nw_stop'), impact=num('nw_impact'); if(!valid(bal,risk,stop,impact)||bal<=0||risk<=0||stop<=0) return warn('nw_result'); const adjustedStop=stop*(1+impact/100); const riskUsd=bal*risk/100; const lot=riskUsd/(adjustedStop*10); const verdict=impact>=100?'Avoid or reduce size heavily':impact>=50?'Use reduced size':'Normal risk acceptable'; showBox('nw_result', `${Math.max(lot,0).toFixed(2)} lots`, `${verdict} · Adjusted stop: ${adjustedStop.toFixed(1)} pips`); }
function calcJournal(){ const checks=document.querySelectorAll('#trade-journal-scorer input[type="checkbox"], #journalTool input[type="checkbox"]'); let score=0; checks.forEach(c=>{ if(c.checked) score++; }); const total=checks.length; if(!total) return warn('jr_result','Checklist items were not found on this page.'); const pct=score/total*100; const verdict=pct>=85?'A+ setup':pct>=65?'B setup — acceptable':'Skip / wait for cleaner setup'; showBox('jr_result', `${pct.toFixed(0)}%`, `${score}/${total} confirmations · ${verdict}`); }
function calcCOT(){ const curr=num('cot_current'), prev=num('cot_prev'); if(!valid(curr,prev)) return warn('cot_result'); const change=curr-prev; const bias=curr>0&&change>0?'Bullish accumulation':curr<0&&change<0?'Bearish distribution':change>0?'Short covering / improving':'Long liquidation / weakening'; showBox('cot_result', change.toLocaleString(), `${bias} · Current net: ${curr.toLocaleString()}`); }
if(typeof window!=='undefined') Object.assign(window,{calcPosition,calcPipValue,calcRR,calcCompound,calcDrawdown,calcFib,calcATR,calcMargin,calcPivots,calcPL,calcExpectancy,calcSwap,calcLotConverter,calcBreakeven,calcSpread,calcRiskGuard,calcNews,calcJournal,calcCOT});


window.VixtreetRefresh = function(){ try{ updateSessions(); loadLiveMarketPulse(); setupTabs(); setupContact(); setupToolCalculators(); }catch(e){ console.warn('Vixtreet refresh failed', e); } };
Object.assign(window,{setupContact,setupToolCalculators,updateSessions,loadLiveMarketPulse,setupTabs});
