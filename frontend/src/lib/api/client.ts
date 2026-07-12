import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { CONFIG, API_PATHS, API_BASE_URL } from '@/lib/constants';
import type { ApiResponse } from '@/lib/types';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动附加 Token
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// 响应拦截器：处理 Token 刷新和统一错误
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface BackendResponse {
  success?: boolean;
  code?: number;
  message?: string;
  data?: unknown;
}

function isBackendResponse(data: unknown): data is BackendResponse {
  return typeof data === 'object' && data !== null && ('success' in data || 'code' in data);
}

client.interceptors.response.use(
  (response) => {
    const { data } = response;
    // 忽略二进制/流式数据
    if (data instanceof Blob || data instanceof ArrayBuffer || typeof data === 'string') {
      return response;
    }
    if (isBackendResponse(data)) {
      // 后端新格式：success===false 或 code>=400 视为业务错误
      if (data.success === false || (data.code != null && data.code >= 400)) {
        return Promise.reject(new Error(data.message || '请求失败'));
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!originalRequest) return Promise.reject(error);

    // 401 — 尝试刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        // 无 refresh token，直接跳转登录
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 已有刷新进行中，排队等待
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string; expiresIn: number }>>(
          API_PATHS.REFRESH_TOKEN,
          { refreshToken }
        );
        const { accessToken, refreshToken: newRefreshToken, expiresIn } = res.data.data;

        localStorage.setItem(CONFIG.TOKEN_KEY, accessToken);
        localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, newRefreshToken);
        localStorage.setItem(CONFIG.TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));

        // 处理队列中的请求
        refreshQueue.forEach((q) => q.resolve(accessToken));
        refreshQueue = [];

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return client(originalRequest);
      } catch (refreshError) {
        refreshQueue.forEach((q) => q.reject(refreshError));
        refreshQueue = [];
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 — 无权限
    if (error.response?.status === 403) {
      console.warn('权限不足');
    }

    return Promise.reject(error);
  }
);

function clearAuthAndRedirect(): void {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
  localStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
  // 仅在前端路由下跳转，避免服务端重定向
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

export default client;
