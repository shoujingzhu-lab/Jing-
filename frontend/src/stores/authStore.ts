import { create } from 'zustand';
import type { User, UserRole } from '@/lib/types';
import { CONFIG } from '@/lib/constants';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;

  login: (user: User, accessToken: string, refreshToken: string, expiresIn: number, rememberMe?: boolean) => void;
  logout: () => void;
  /** 应用启动时初始化 auth 状态（检查持久化 token） */
  initialize: () => void;

  hasPermission: (requiredRoles?: UserRole[]) => boolean;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  login: (user, accessToken, refreshToken, expiresIn, rememberMe) => {
    const tokenExpiry = Date.now() + expiresIn * 1000;

    if (rememberMe) {
      localStorage.setItem(CONFIG.TOKEN_KEY, accessToken);
      localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(CONFIG.TOKEN_EXPIRY_KEY, String(tokenExpiry));
    } else {
      sessionStorage.setItem(CONFIG.TOKEN_KEY, accessToken);
      sessionStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, refreshToken);
      sessionStorage.setItem(CONFIG.TOKEN_EXPIRY_KEY, String(tokenExpiry));
    }

    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
    localStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(CONFIG.TOKEN_KEY);
    sessionStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);

    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  initialize: () => {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY) || sessionStorage.getItem(CONFIG.TOKEN_KEY);
    const expiryStr = localStorage.getItem(CONFIG.TOKEN_EXPIRY_KEY) || sessionStorage.getItem(CONFIG.TOKEN_EXPIRY_KEY);

    if (token && expiryStr) {
      const isExpired = Date.now() > parseInt(expiryStr, 10) - 5 * 60 * 1000;
      if (!isExpired) {
        set({ user: null, isAuthenticated: true, isLoading: false });
        return;
      }
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
      localStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
      sessionStorage.removeItem(CONFIG.TOKEN_KEY);
      sessionStorage.removeItem(CONFIG.REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(CONFIG.TOKEN_EXPIRY_KEY);
    }

    // 无有效 token → 未认证，跳转登录页
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  hasPermission: (requiredRoles) => {
    const { user } = get();
    if (!requiredRoles || requiredRoles.length === 0) return true;
    // user 为 null 但已认证（如从 localStorage 恢复 token），按最低权限处理
    if (!user) return requiredRoles.includes('user');
    return requiredRoles.includes(user.role);
  },

  isTokenExpired: () => {
    const expiryStr =
      localStorage.getItem(CONFIG.TOKEN_EXPIRY_KEY) ||
      sessionStorage.getItem(CONFIG.TOKEN_EXPIRY_KEY);
    if (!expiryStr) return true;
    // 提前 5 分钟视为过期
    return Date.now() > parseInt(expiryStr, 10) - 5 * 60 * 1000;
  },
}));
