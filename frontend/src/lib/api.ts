import axios from 'axios';
import { emitUnauthorized } from '@/lib/auth-events';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_PATHS = ['/auth/signin', '/auth/signup', '/auth/me'];

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const isAuthPath = AUTH_PATHS.some((path) => url.includes(path));
      if (!isAuthPath) {
        emitUnauthorized();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
