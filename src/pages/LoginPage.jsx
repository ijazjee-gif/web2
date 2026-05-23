import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [captcha, setCaptcha] = useState(null);
  const [form, setForm] = useState({ login: '', password: '', captchaAnswer: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';
  const loadCaptcha = () => fetch('/api/auth/captcha').then(r => r.json()).then(d => setCaptcha(d.captcha));
  useEffect(() => { loadCaptcha(); }, []);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...form, captchaToken: captcha?.token }) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.needsVerification) navigate('/verify-email');
        throw new Error(data.error || 'Login failed');
      }
      navigate(from, { replace: true });
    } catch (err) { setError(err.message); loadCaptcha(); setForm(v => ({ ...v, captchaAnswer: '' })); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="container"><section className="panel glow auth-card"><div className="tag"><span className="pulse"/><span>Secure Login</span></div><h1 style={{fontSize:42,marginTop:18}}>Login to dashboard</h1><p className="muted" style={{marginTop:12}}>Only email-verified accounts can access the member dashboard.</p>{error && <div className="status-alert error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>Username or email<input value={form.login} onChange={e=>setForm({...form,login:e.target.value})} required /></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required autoComplete="current-password" /></label><div className="captcha-box"><label>Human verification: {captcha?.question || 'Loading...'}<input value={form.captchaAnswer} onChange={e=>setForm({...form,captchaAnswer:e.target.value})} required inputMode="numeric" /></label></div><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Checking...':'Login'}</button></form><div className="auth-links"><span>No account?</span><Link to="/signup">Create account</Link></div></section></div></main>;
}
