import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function VerifyEmailPage(){
  const location = useLocation();
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [success,setSuccess]=useState(location.state?.debugCode ? `Testing code: ${location.state.debugCode}` : '');
  const [busy,setBusy]=useState(false);
  const navigate=useNavigate();
  async function submit(e){e.preventDefault();setError('');setBusy(true);try{const res=await fetch('/api/auth/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({code})});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'Verification failed');navigate('/dashboard',{replace:true});}catch(err){setError(err.message);}finally{setBusy(false);}}
  async function resend(){setError('');setSuccess('');try{const res=await fetch('/api/auth/resend-code',{method:'POST',credentials:'include'});const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.error||'Could not resend code');setSuccess(data.debugCode?`Testing code: ${data.debugCode}`:'A new email verification code has been sent.');}catch(err){setError(err.message);}}
  return <main className="auth-shell"><div className="container"><section className="panel glow auth-card"><div className="tag"><span className="pulse"/><span>Email Verification</span></div><h1 style={{fontSize:42,marginTop:18}}>Enter your email code</h1><p className="muted" style={{marginTop:12}}>We sent a 6-digit code to your signup email. Email verification is mandatory before dashboard access.</p>{success&&<div className="status-alert success">{success}</div>}{error&&<div className="status-alert error">{error}</div>}<form className="auth-form" onSubmit={submit}><label>6-digit email code<input value={code} onChange={e=>setCode(e.target.value)} required maxLength="6" pattern="[0-9]{6}" inputMode="numeric" /></label><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Verifying...':'Verify email & open dashboard'}</button></form><button className="btn btn-ghost" style={{marginTop:12}} type="button" onClick={resend}>Resend code</button><div className="auth-links"><Link to="/login">Back to login</Link></div></section></div></main>;
}
