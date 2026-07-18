import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { CONFIG, API_PATHS, API_BASE_URL } from '@/lib/constants';
import type { ApiResponse } from '@/lib/types';
import { useAppStore } from '@/stores/appStore';

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动附加 Token + 记录开始时间
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY) || sessionStorage.getItem(CONFIG.TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 记录请求开始时间，用于计算延迟
    (config as InternalAxiosRequestConfig & { _startTime: number })._startTime = Date.now();
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
    // 计算 API 延迟并写入 store
    const startTime = (response.config as InternalAxiosRequestConfig & { _startTime?: number })._startTime;
    if (startTime) {
      const latency = Date.now() - startTime;
      useAppStore.getState().setMarketLatency(latency);
    }

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
      // 自动解包 + 同步服务器时间
      if (data.success && data.data !== undefined) {
        const ts = data.timestamp;
        response.data = data.data;
        if (ts) {
          (response.data as Record<string, unknown>)._serverTime = ts;
          useAppStore.getState().setCurrentUtcTime(ts as string);
        }
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _rateLimitRetry?: number };
    if (!originalRequest) return Promise.reject(error);

    // 401 — 尝试刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 同时检查 localStorage 和 sessionStorage
      let refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
      let tokenStorage: 'local' | 'session' = 'local';
      if (!refreshToken) {
        refreshToken = sessionStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
        tokenStorage = 'session';
      }
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

        const storage = tokenStorage === 'session' ? sessionStorage : localStorage;
        storage.setItem(CONFIG.TOKEN_KEY, accessToken);
        storage.setItem(CONFIG.REFRESH_TOKEN_KEY, newRefreshToken);
        storage.setItem(CONFIG.TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));

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

    // 429 — 限流，自动重试 (最多3次，指数退避)
    if (error.response?.status === 429 && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = (originalRequest._rateLimitRetry || 0) + 1;
      const maxRetries = 3;
      if (originalRequest._rateLimitRetry <= maxRetries) {
        const delay = Math.pow(2, originalRequest._rateLimitRetry) * 1000; // 2s, 4s, 8s
        console.warn(`[RateLimit] 请求被限流，${delay / 1000}s 后重试 (${originalRequest._rateLimitRetry}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, delay));
        return client(originalRequest);
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
  const storages = [localStorage, sessionStorage];
  storages.forEach((s) => {
    s.removeItem(CONFIG.TOKEN_KEY);
    s.removeItem(CONFIG.REFRESH_TOKEN_KEY);
    s.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
  });
  // 仅在前端路由下跳转，避免服务端重定向
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

export default client;
