import axios, { type InternalAxiosRequestConfig } from 'axios';
import { emitUnauthorized } from '@/lib/auth-events';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const SKIP_REFRESH_PATHS = ['/auth/signin', '/auth/signup', '/auth/refresh'];

let refreshPromise: Promise<void> | null = null;

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

async function refreshSession(): Promise<void> {
  await api.post('/auth/refresh');
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;
    if (!config || shouldSkipRefresh(config.url)) {
      return Promise.reject(error);
    }

    if (config._retried) {
      emitUnauthorized();
      return Promise.reject(error);
    }

    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      config._retried = true;
      return api.request(config);
    } catch {
      emitUnauthorized();
      return Promise.reject(error);
    }
  },
);

export default api;
