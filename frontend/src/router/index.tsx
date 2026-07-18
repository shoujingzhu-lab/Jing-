import { Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppStore } from '@/stores/appStore';
import { darkTheme, lightTheme } from '@/styles/antd-theme';
import MainLayout from '@/components/Layout/MainLayout';
import AuthLayout from '@/components/Layout/AuthLayout';
import { wsManager } from '@/lib/ws/manager';
import { adminApi } from '@/lib/api';
import { useRealtimeMarket } from '@/hooks/useRealtimeMarket';
import { routes, authPaths } from './routes';
import 'antd/dist/reset.css';
import '@/styles/index.css';
import '@/styles/glass.css';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,           // 10秒后数据变"旧"，后台静默刷新
      gcTime: 5 * 60_000,          // 缓存保留5分钟
      retry: 2,
      refetchOnWindowFocus: true,  // 切回浏览器标签页时刷新
      refetchOnMount: true,        // 切页面时如果数据过期就后台刷新（不阻塞渲染）
    },
  },
});

/** 路由守卫 — 包含角色权限检查 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const location = useLocation();
  const isAuthPath = authPaths.some((p) => location.pathname.startsWith(p));

  const matchedRoute = useMemo(
    () => routes.find((r) => matchPath(r.path, location.pathname)),
    [location.pathname],
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0D1117' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated && isAuthPath) {
    return <Navigate to="/" replace />;
  }

  if (!isAuthenticated && !isAuthPath) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && matchedRoute?.roles && matchedRoute.roles.length > 0) {
    if (!hasPermission(matchedRoute.roles)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

/** 页面加载指示器 */
function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 300 }}>
      <Spin size="large" />
    </div>
  );
}

/** 主题同步 + 系统时间 + auth 初始化 + WebSocket */
function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setCurrentUtcTime = useAppStore((s) => s.setCurrentUtcTime);
  const setWsStatus = useAppStore((s) => s.setWsStatus);
  const setExchangeConnections = useAppStore((s) => s.setExchangeConnections);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const tick = () => setCurrentUtcTime(new Date().toISOString());
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [isAuthenticated, setCurrentUtcTime]);

  // WebSocket 实时行情推送（OKX，国内可用）
  useRealtimeMarket('okx');

  // WebSocket 连接管理
  useEffect(() => {
    if (!isAuthenticated) {
      wsManager.disconnectAll();
      setWsStatus('disconnected');
      return;
    }

    const token = localStorage.getItem('quant_access_token');
    if (!token) return;

    // 监听状态变化 → 同步到 appStore
    const unsub = wsManager.onStateChange((state) => {
      setWsStatus(state);
    });

    // 通过 Vite 代理连接 WebSocket（避免跨端口问题）
    const wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    wsManager.connect('market', `${wsBase}/ws/market?token=${token}`);
    wsManager.connect('user', `${wsBase}/ws/user?token=${token}`);

    return () => {
      unsub();
      wsManager.disconnectAll();
      setWsStatus('disconnected');
    };
  }, [isAuthenticated, setWsStatus]);

  // 交易所连接状态检测 — 使用真实 /admin/exchanges/status API
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExchanges = async () => {
      try {
        const res = await adminApi.getExchangeStatus();
        const d = res.data as unknown as { exchanges?: Record<string, string> };
        const rawStatus = d?.exchanges || {};
        // 后端返回 gateio，前端用 gate
        const statusMap: Record<string, string> = {
          binance: rawStatus.binance || 'disconnected',
          okx: rawStatus.okx || 'disconnected',
          bybit: rawStatus.bybit || 'disconnected',
          gate: rawStatus.gateio || rawStatus.gate || 'disconnected',
        };

        type ExKey = 'binance' | 'okx' | 'bybit' | 'gate';
        const allExchanges: ExKey[] = ['binance', 'okx', 'bybit', 'gate'];
        const connections = allExchanges.map((ex) => ({
          exchange: ex,
          status: (statusMap[ex] === 'connected' ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
          latency: 0,
        }));
        setExchangeConnections(connections);
      } catch {
        // 失败保持上次状态
      }
    };

    checkExchanges();
    const timer = setInterval(checkExchanges, 30000);
    return () => clearInterval(timer);
  }, [isAuthenticated, setExchangeConnections]);

  return <>{children}</>;
}

export default function AppRouter() {
  const theme = useSettingsStore((s) => s.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
        <BrowserRouter>
          <AppShell>
            <AuthGuard>
              <Routes>
                <Route element={<AuthLayout />}>
                  {routes
                    .filter((r) => authPaths.includes(r.path))
                    .map((r) => (
                      <Route
                        key={r.path}
                        path={r.path}
                        element={
                          <Suspense fallback={<PageLoading />}>
                            <r.element />
                          </Suspense>
                        }
                      />
                    ))}
                </Route>

                <Route element={<MainLayout />}>
                  {routes
                    .filter((r) => !authPaths.includes(r.path))
                    .map((r) => (
                      <Route
                        key={r.path}
                        path={r.path}
                        element={
                          <Suspense fallback={<PageLoading />}>
                            <r.element />
                          </Suspense>
                        }
                      />
                    ))}
                </Route>

                <Route
                  path="*"
                  element={
                    <Suspense fallback={<PageLoading />}>
                      <Navigate to="/" replace />
                    </Suspense>
                  }
                />
              </Routes>
            </AuthGuard>
          </AppShell>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
