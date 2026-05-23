import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const words=['Alpha','Vertex','Pulse','Candle','Matrix','Falcon','Quantum','Nova'];
const symbols=['#','!','@','$','%'];
function makePass(){return words[Math.floor(Math.random()*words.length)] + words[Math.floor(Math.random()*words.length)] + Math.floor(1000+Math.random()*9000) + symbols[Math.floor(Math.random()*symbols.length)] + 'AI';}
function score(v){let s=0;if(v.length>=10)s++;if(/[A-Z]/.test(v))s++;if(/[a-z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;return s;}

export default function SignupPage() {
  const [captcha, setCaptcha] = useState(null);
  const [form, setForm] = useState({ username:'', email:'', mobile:'', password:'', confirmPassword:'', captchaAnswer:'' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const suggestions = useMemo(()=>Array.from({length:4}, makePass), []);
  const loadCaptcha = () => fetch('/api/auth/captcha').then(r => r.json()).then(d => setCaptcha(d.captcha));
  useEffect(()=>{ loadCaptcha(); }, []);
  async function submit(e){
    e.preventDefault(); setError(''); setSuccess(''); setBusy(true);
    try{
      const res=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({...form,captchaToken:captcha?.token})});
      const data=await res.json();
      if(!res.ok||!data.ok) throw new Error(data.error||'Signup failed');
      if(data.debugCode) setSuccess(`Testing verification code: ${data.debugCode}`);
      navigate('/verify-email', { state: { debugCode: data.debugCode } });
    }catch(err){ setError(err.message); loadCaptcha(); setForm(v=>({...v,captchaAnswer:''})); }
    finally{ setBusy(false); }
  }
  return <main className="auth-shell"><div className="container auth-grid"><section className="panel glow auth-card"><div className="tag"><span className="pulse"/><span>Member Signup</span></div><h1 style={{fontSize:42,marginTop:18}}>Create your trading account</h1><p className="muted" style={{marginTop:12}}>Email verification is mandatory. WhatsApp number is stored; WhatsApp verification remains optional.</p>{error && <div className="status-alert error">{error}</div>}{success && <div className="status-alert success">{success}</div>}<form className="auth-form" onSubmit={submit}><label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required minLength="3" maxLength="32" pattern="[A-Za-z0-9_]{3,32}" /></label><label>Email address<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required /></label><label>Mobile / WhatsApp number<input type="tel" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="+923001234567" required /></label><label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength="10" autoComplete="new-password" /></label><div className="password-meter"><span style={{width:`${score(form.password)*20}%`}} /></div><label>Confirm password<input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} required minLength="10" autoComplete="new-password" /></label><div className="captcha-box"><label>Human verification: {captcha?.question || 'Loading...'}<input value={form.captchaAnswer} onChange={e=>setForm({...form,captchaAnswer:e.target.value})} required inputMode="numeric" /></label></div><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Creating...':'Create account & send email code'}</button></form><div className="auth-links"><span>Already have an account?</span><Link to="/login">Login</Link></div></section><aside className="panel auth-card"><h2 className="section-title" style={{fontSize:34}}>Password suggestions</h2><p className="muted" style={{marginTop:10}}>Click any strong example to fill the password field, then save it securely.</p><div className="password-suggestions" style={{marginTop:18}}>{suggestions.map(p=><button key={p} type="button" className="btn btn-ghost btn-sm" onClick={()=>setForm(v=>({...v,password:p,confirmPassword:p}))}>{p}</button>)}</div><div className="note" style={{marginTop:18}}>Required: 10+ characters, uppercase, lowercase, number and symbol. Avoid using your name, phone number or common words.</div></aside></div></main>;
}
