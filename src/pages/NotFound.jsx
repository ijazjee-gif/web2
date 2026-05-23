import { Link } from 'react-router-dom';
export default function NotFound() {
  return <main className="not-found"><div className="container panel"><span className="badge badge-red">404</span><h1 style={{marginTop:16}}>Page not found</h1><p className="muted" style={{marginTop:12}}>The requested route does not exist in the merged React website.</p><Link className="btn btn-primary" to="/" style={{marginTop:20}}>Back to Home</Link></div></main>;
}
