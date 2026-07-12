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
import { routes, authPaths } from './routes';
import 'antd/dist/reset.css';
import '@/styles/index.css';
import '@/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
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

/** 主题同步 + 系统时间 + auth 初始化 */
function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setCurrentUtcTime = useAppStore((s) => s.setCurrentUtcTime);
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
