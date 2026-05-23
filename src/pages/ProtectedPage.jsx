import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedPage({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });
  const location = useLocation();
  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => mounted && setState({ loading: false, ok: Boolean(data.authenticated) }))
      .catch(() => mounted && setState({ loading: false, ok: false }));
    return () => { mounted = false; };
  }, []);
  if (state.loading) return <main className="protected-loader"><div className="container"><div className="panel">Checking secure dashboard access...</div></div></main>;
  if (!state.ok) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
