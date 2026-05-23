import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const tools = [
  ['Position Size Calculator', '/tools/position-size-calculator'],
  ['Pip Value Calculator', '/tools/pip-value-calculator'],
  ['Risk Reward Calculator', '/tools/risk-reward-calculator'],
  ['Compounding Calculator', '/tools/compounding-calculator'],
  ['Drawdown Recovery Calculator', '/tools/drawdown-recovery-calculator'],
  ['Fibonacci Calculator', '/tools/fibonacci-calculator'],
  ['ATR Stop Loss Tool', '/tools/atr-stop-loss-tool'],
  ['Margin Calculator', '/tools/margin-calculator'],
  ['Pivot Point Calculator', '/tools/pivot-point-calculator'],
  ['Profit / Loss Calculator', '/tools/profit-loss-calculator'],
  ['Expectancy Calculator', '/tools/expectancy-calculator'],
  ['Swap Calculator', '/tools/swap-calculator'],
  ['Lot Converter', '/tools/lot-converter'],
  ['Break-even Win Rate Calculator', '/tools/break-even-win-rate-calculator'],
  ['Spread Cost Calculator', '/tools/spread-cost-calculator'],
  ['Account Risk Guard', '/tools/account-risk-guard'],
  ['News Impact Risk Tool', '/tools/news-impact-risk-tool'],
  ['Trade Journal Scorer', '/tools/trade-journal-scorer']
];

function activeClass({ isActive }) {
  return isActive ? 'active' : undefined;
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setUser(data.authenticated ? data.user : null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/');
  }

  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <Link className="brand" to="/" onClick={() => setOpen(false)}>
            <img alt="xxxxxxxxxx icon" className="site-icon" src="/assets/img/site-icon.svg" />
            <span>xxxxxxxxxx</span>
          </Link>
          <nav className={`nav-links ${open ? 'open' : ''}`} id="navLinks">
            <NavLink to="/dashboard" className={activeClass} onClick={() => setOpen(false)}>Dashboard</NavLink>
            <NavLink to="/live" className={activeClass} onClick={() => setOpen(false)}>Live Terminal</NavLink>
            <div className="nav-dropdown">
              <NavLink to="/tools" className="nav-drop-link" onClick={() => setOpen(false)}>Tools <span>▾</span></NavLink>
              <div className="dropdown-menu">
                <Link to="/tools" onClick={() => setOpen(false)}>Tools Directory</Link>
                {tools.map(([label, to]) => <Link key={to} to={to} onClick={() => setOpen(false)}>{label}</Link>)}
              </div>
            </div>
            <NavLink to="/cot" className={activeClass} onClick={() => setOpen(false)}>COT Dashboard</NavLink>
            <NavLink to="/education" className={activeClass} onClick={() => setOpen(false)}>Education</NavLink>
            <div className="nav-dropdown">
              <NavLink to="/blog" className="nav-drop-link" onClick={() => setOpen(false)}>Blog <span>▾</span></NavLink>
              <div className="dropdown-menu compact-menu">
                <Link to="/blog" onClick={() => setOpen(false)}>Research Blog</Link>
                <Link to="/about" onClick={() => setOpen(false)}>About</Link>
                <Link to="/contact" onClick={() => setOpen(false)}>Contact</Link>
              </div>
            </div>
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-pill">Hi, {user.username}</span>
                <button className="btn btn-ghost" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/login">Login</Link>
                <Link className="btn btn-primary keep" to="/signup">Sign Up</Link>
              </>
            )}
            <button aria-expanded={open ? 'true' : 'false'} aria-label="Open menu" className="btn mobile-toggle" onClick={() => setOpen(v => !v)}>☰</button>
          </div>
        </div>
      </header>
      <div className="page-shell">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand"><img alt="xxxxxxxxxx icon" className="site-icon" src="/assets/img/site-icon.svg" /><strong>xxxxxxxxxx</strong></div>
          <p>AI-powered trading intelligence, premium dashboards, live market tools, COT bias and trader education in one clean platform.</p>
          <div style={{ marginTop: 12 }}><span className="badge">AI Trading Suite</span></div>
        </div>
        <div><div><Link to="/dashboard">Dashboard</Link></div><div><Link to="/live">Live Terminal</Link></div><div><Link to="/tools">Tools</Link></div><div><Link to="/cot">COT Dashboard</Link></div></div>
        <div><div><Link to="/education">Education</Link></div><div><Link to="/blog">Research Blog</Link></div><div><Link to="/about">About</Link></div><div><Link to="/contact">Contact</Link></div></div>
        <div><p>Risk notice: Trading involves risk. Tools are educational estimates, not financial advice.</p><p style={{ marginTop: 12 }}>© {new Date().getFullYear()} xxxxxxxxxx. All rights reserved.</p></div>
      </div>
    </footer>
  );
}
