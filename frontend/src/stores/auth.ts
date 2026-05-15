import { computed, ref } from 'vue';
import { apiMe, apiLogin, type AppRole, type AuthUser } from '../api/authApi';

export const AUTH_TOKEN_KEY = 'score_auth_token';
const USER_KEY = 'score_auth_user';

export const authToken = ref<string | null>(null);
export const authUser = ref<AuthUser | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function restoreAuth(): void {
  authToken.value = localStorage.getItem(AUTH_TOKEN_KEY);
  authUser.value = readStoredUser();
}

export function clearAuth(): void {
  authToken.value = null;
  authUser.value = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function setSession(token: string, user: AuthUser): void {
  authToken.value = token;
  authUser.value = user;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export const isLoggedIn = computed(() => Boolean(authToken.value));

export const canWriteScores = computed(
  () =>
    authUser.value?.role === 'Academic_Affairs' || authUser.value?.role === 'DepartmentTeacher',
);

export function isStudent(): boolean {
  return authUser.value?.role === 'Student';
}

export function isExternalVerifier(): boolean {
  return authUser.value?.role === 'ExternalVerifier';
}

export function isTeacherOrAdmin(): boolean {
  return canWriteScores.value;
}

export async function login(username: string, password: string): Promise<void> {
  const data = await apiLogin(username, password);
  setSession(data.token, data.user);
}

/** 启动时校验本地 token；无效则清空 */
export async function validateSession(): Promise<void> {
  const t = authToken.value;
  if (!t) return;
  try {
    const me = await apiMe(t);
    authUser.value = {
      username: me.username,
      displayName: me.displayName,
      role: me.role,
      org: me.org,
      attributes: me.attributes,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(authUser.value));
  } catch {
    clearAuth();
  }
}

export function roleLabel(role: AppRole | undefined): string {
  if (!role) return '未登录';
  const m: Record<AppRole, string> = {
    Academic_Affairs: '教务处',
    DepartmentTeacher: '教师',
    Student: '学生',
    ExternalVerifier: '用人单位（验真）',
  };
  return m[role] ?? role;
}
