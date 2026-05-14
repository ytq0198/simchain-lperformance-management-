import axios from 'axios';
import { ElMessage } from 'element-plus';
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
    const msg =
      err.response?.data && typeof err.response.data.error === 'string'
        ? err.response.data.error
        : err.message || '网络错误';
    ElMessage.error(msg);
    return Promise.reject(err);
  },
);
