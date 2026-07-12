import { lazy } from 'react';
import type { UserRole } from '@/lib/types';

export interface RouteConfig {
  path: string;
  element: React.LazyExoticComponent<React.ComponentType>;
  roles?: UserRole[];
  title?: string;
}

// 懒加载页面
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const MarketPage = lazy(() => import('@/pages/MarketPage'));
const MarketDetailPage = lazy(() => import('@/pages/MarketDetailPage'));
const StrategyListPage = lazy(() => import('@/pages/StrategyListPage'));
const VisualStrategyPage = lazy(() => import('@/pages/VisualStrategyPage'));
const CodeStrategyPage = lazy(() => import('@/pages/CodeStrategyPage'));
const StrategyDetailPage = lazy(() => import('@/pages/StrategyDetailPage'));
const BacktestListPage = lazy(() => import('@/pages/BacktestListPage'));
const NewBacktestPage = lazy(() => import('@/pages/NewBacktestPage'));
const BacktestReportPage = lazy(() => import('@/pages/BacktestReportPage'));
const PortfolioBacktestPage = lazy(() => import('@/pages/PortfolioBacktestPage'));
const PortfolioReportPage = lazy(() => import('@/pages/PortfolioReportPage'));
const SimOverviewPage = lazy(() => import('@/pages/SimOverviewPage'));
const SimAccountDetailPage = lazy(() => import('@/pages/SimAccountDetailPage'));
const TradePage = lazy(() => import('@/pages/TradePage'));
const TradeAccountDetailPage = lazy(() => import('@/pages/TradeAccountDetailPage'));
const FundingRatePage = lazy(() => import('@/pages/FundingRatePage'));
const OrderRoutingPage = lazy(() => import('@/pages/OrderRoutingPage'));
const RiskPanelPage = lazy(() => import('@/pages/RiskPanelPage'));
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage'));
const StrategyDiagnosisPage = lazy(() => import('@/pages/StrategyDiagnosisPage'));
const AltcoinCorrelationPage = lazy(() => import('@/pages/AltcoinCorrelationPage'));
const DataCenterPage = lazy(() => import('@/pages/DataCenterPage'));
const WebhookPage = lazy(() => import('@/pages/WebhookPage'));
const NotificationPage = lazy(() => import('@/pages/NotificationPage'));
const PriceAlertPage = lazy(() => import('@/pages/PriceAlertPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ApiKeyPage = lazy(() => import('@/pages/ApiKeyPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminExchangesPage = lazy(() => import('@/pages/AdminExchangesPage'));
const AdminTasksPage = lazy(() => import('@/pages/AdminTasksPage'));
const AdminBacktestQueuePage = lazy(() => import('@/pages/AdminBacktestQueuePage'));
const AdminAlertRulesPage = lazy(() => import('@/pages/AdminAlertRulesPage'));
const AdminSystemPage = lazy(() => import('@/pages/AdminSystemPage'));
const AdminAuditPage = lazy(() => import('@/pages/AdminAuditPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/** 完整路由表（42 条路由，严格对应需求文档 2.1 节） */
export const routes: RouteConfig[] = [
  // 认证（无布局）
  { path: '/login', element: LoginPage, title: '登录' },
  { path: '/register', element: RegisterPage, title: '注册' },
  { path: '/forgot-password', element: ForgotPasswordPage, title: '忘记密码' },

  // 仪表盘
  { path: '/', element: DashboardPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '仪表盘' },

  // 行情
  { path: '/market', element: MarketPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '行情中心' },
  { path: '/market/:symbol', element: MarketDetailPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '交易对详情' },

  // 策略
  { path: '/strategy', element: StrategyListPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '策略列表' },
  { path: '/strategy/visual/new', element: VisualStrategyPage, roles: ['user', 'advanced_user', 'admin'], title: '新建可视化策略' },
  { path: '/strategy/visual/:id', element: VisualStrategyPage, roles: ['user', 'advanced_user', 'admin'], title: '编辑可视化策略' },
  { path: '/strategy/code/new', element: CodeStrategyPage, roles: ['advanced_user', 'admin'], title: '新建代码策略' },
  { path: '/strategy/code/:id', element: CodeStrategyPage, roles: ['advanced_user', 'admin'], title: '编辑代码策略' },
  { path: '/strategy/:id/detail', element: StrategyDetailPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '策略详情' },

  // 回测
  { path: '/backtest', element: BacktestListPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '回测任务列表' },
  { path: '/backtest/new', element: NewBacktestPage, roles: ['user', 'advanced_user', 'admin'], title: '新建回测' },
  { path: '/backtest/:id', element: BacktestReportPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '回测报告' },
  { path: '/backtest/portfolio', element: PortfolioBacktestPage, roles: ['user', 'advanced_user', 'admin'], title: '策略组合回测' },
  { path: '/backtest/portfolio/:id', element: PortfolioReportPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '组合回测报告' },

  // 模拟交易
  { path: '/sim', element: SimOverviewPage, roles: ['user', 'advanced_user', 'admin'], title: '模拟交易' },
  { path: '/sim/:accountId', element: SimAccountDetailPage, roles: ['user', 'advanced_user', 'admin'], title: '模拟账户详情' },

  // 实盘交易
  { path: '/trade', element: TradePage, roles: ['advanced_user', 'admin'], title: '实盘交易' },
  { path: '/trade/:accountId', element: TradeAccountDetailPage, roles: ['advanced_user', 'admin'], title: '实盘账户详情' },
  { path: '/trade/funding-rate', element: FundingRatePage, roles: ['user', 'advanced_user', 'admin'], title: '资金费率管理' },
  { path: '/trade/order-routing', element: OrderRoutingPage, roles: ['advanced_user', 'admin'], title: '订单路由配置' },

  // 风控
  { path: '/risk', element: RiskPanelPage, roles: ['user', 'advanced_user', 'admin'], title: '风控面板' },

  // 智能分析
  { path: '/analysis', element: AnalysisPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '智能分析' },
  { path: '/analysis/strategy/:id', element: StrategyDiagnosisPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '策略诊断详情' },
  { path: '/analysis/correlation', element: AltcoinCorrelationPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '山寨币关联分析' },

  // 数据中心
  { path: '/data', element: DataCenterPage, roles: ['user', 'advanced_user', 'admin'], title: '数据中心' },
  { path: '/data/webhooks', element: WebhookPage, roles: ['user', 'advanced_user', 'admin'], title: 'Webhook 管理' },

  // 通知
  { path: '/notifications', element: NotificationPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '通知中心' },
  { path: '/notifications/price-alerts', element: PriceAlertPage, roles: ['user', 'advanced_user', 'admin'], title: '价格告警' },

  // 设置
  { path: '/settings', element: SettingsPage, roles: ['user', 'advanced_user', 'strategy_reviewer', 'admin'], title: '账户设置' },
  { path: '/settings/api-keys', element: ApiKeyPage, roles: ['user', 'advanced_user', 'admin'], title: 'API Key 管理' },

  // 管理后台
  { path: '/admin', element: AdminDashboardPage, roles: ['admin'], title: '管理后台' },
  { path: '/admin/users', element: AdminUsersPage, roles: ['admin'], title: '用户管理' },
  { path: '/admin/exchanges', element: AdminExchangesPage, roles: ['admin'], title: '交易所管理' },
  { path: '/admin/system', element: AdminSystemPage, roles: ['admin'], title: '系统配置' },
  { path: '/admin/tasks', element: AdminTasksPage, roles: ['admin'], title: '定时任务管理' },
  { path: '/admin/backtest-queue', element: AdminBacktestQueuePage, roles: ['admin'], title: '回测队列管理' },
  { path: '/admin/alert-rules', element: AdminAlertRulesPage, roles: ['admin'], title: '系统告警规则' },
  { path: '/admin/audit', element: AdminAuditPage, roles: ['admin'], title: '审计日志' },
];

// 无需主布局的路由
export const authPaths = ['/login', '/register', '/forgot-password'];
