function apiBase(): string {
  return import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';
}

export type AppRole =
  | 'Academic_Affairs'
  | 'DepartmentTeacher'
  | 'Student'
  | 'ExternalVerifier';

export interface AuthUser {
  username: string;
  displayName: string;
  role: AppRole;
  org: string;
  attributes: Record<string, string>;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${apiBase()}${path}`, init);
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) {
    const msg = typeof body.error === 'string' ? body.error : r.statusText;
    throw new Error(msg || `HTTP ${r.status}`);
  }
  return body as T;
}

export async function apiLogin(username: string, password: string) {
  return jsonFetch<{ token: string; user: AuthUser; fabricProfile: string }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function apiMe(token: string) {
  return jsonFetch<AuthUser & { fabricProfile: string }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
