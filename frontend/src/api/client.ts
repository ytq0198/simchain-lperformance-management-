import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';
import { AUTH_TOKEN_KEY, clearAuth } from '../stores/auth';
import { loadingDone, loadingStart } from '../stores/globalLoading';

const baseURL = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';

export const api = axios.create({
  baseURL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    loadingStart();
    const t = localStorage.getItem(AUTH_TOKEN_KEY);
    if (t) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${t}`;
    }
    return config;
  },
  (err) => {
    loadingDone();
    return Promise.reject(err);
  },
);

api.interceptors.response.use(
  (res) => {
    loadingDone();
    return res;
  },
  (err) => {
    loadingDone();
    const status = err.response?.status as number | undefined;
    const url = String(err.config?.url ?? '');
    const msg =
      err.response?.data && typeof err.response.data.error === 'string'
        ? err.response.data.error
        : err.message || '网络错误';

    if (status === 401 && !url.includes('/api/auth/')) {
      clearAuth();
      if (router.currentRoute.value.path !== '/login') {
        void router.replace({
          path: '/login',
          query: { redirect: router.currentRoute.value.fullPath },
        });
      }
      return Promise.reject(err);
    }

    if (status === 403) {
      ElMessage.warning(msg);
      return Promise.reject(err);
    }

    ElMessage.error(msg);
    return Promise.reject(err);
  },
);
