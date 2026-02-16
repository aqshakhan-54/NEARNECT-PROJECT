// Minimal API helper for auth + headers
export function getApiBase() {
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocal) return 'http://localhost:5000';
  if (typeof window !== 'undefined' && window.NEARNect_API_BASE) return window.NEARNect_API_BASE;
  const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="api-base"]') : null;
  if (meta && meta.content) return meta.content;
  return 'https://your-render-app.onrender.com';
}

export function saveToken(token) {
  localStorage.setItem('nearnect_token', token);
}

export function getToken() {
  return localStorage.getItem('nearnect_token');
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function login(email, password) {
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  saveToken(data.token);
  return data;
}

export async function ensureDemoLogin() {
  if (getToken()) return getToken();
  try {
    const res = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@nearnect.app', password: 'demo1234' })
    });
    if (!res.ok) return null;
    const data = await res.json();
    saveToken(data.token);
    return data.token;
  } catch (_) { return null; }
}

export function logoutAndRedirect() {
  try { localStorage.removeItem('nearnect_token'); } catch(_) {}
  const loginUrl = `login.html?next=${encodeURIComponent(location.pathname.split('/').pop())}`;
  location.href = loginUrl;
}

export function requireAuthOrRedirect() {
  if (!getToken()) logoutAndRedirect();
}
