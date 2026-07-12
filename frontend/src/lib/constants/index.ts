import type { Exchange, KlinePeriod, MarketType } from '@/lib/types';

// ========== 交易所 ==========

export const EXCHANGES: { key: Exchange; label: string; icon: string }[] = [
  { key: 'binance', label: 'Binance', icon: '🔶' },
  { key: 'okx', label: 'OKX', icon: '🔷' },
  { key: 'bybit', label: 'Bybit', icon: '⬛' },
  { key: 'gate', label: 'Gate.io', icon: '🟢' },
];

export const EXCHANGE_MAP: Record<Exchange, string> = {
  binance: 'Binance',
  okx: 'OKX',
  bybit: 'Bybit',
  gate: 'Gate.io',
};

// ========== 市场类型 ==========

export const MARKET_TYPES: { key: MarketType; label: string }[] = [
  { key: 'spot', label: '现货' },
  { key: 'perpetual', label: '永续合约' },
  { key: 'futures', label: '交割合约' },
  { key: 'leveraged_token', label: '杠杆代币' },
];

export const MARKET_TYPE_MAP: Record<MarketType, string> = {
  spot: '现货',
  perpetual: '永续合约',
  futures: '交割合约',
  leveraged_token: '杠杆代币',
};

// ========== K线周期 ==========

export const KLINE_PERIODS: { key: KlinePeriod; label: string; minutes: number }[] = [
  { key: '1m', label: '1分钟', minutes: 1 },
  { key: '3m', label: '3分钟', minutes: 3 },
  { key: '5m', label: '5分钟', minutes: 5 },
  { key: '15m', label: '15分钟', minutes: 15 },
  { key: '30m', label: '30分钟', minutes: 30 },
  { key: '1h', label: '1小时', minutes: 60 },
  { key: '4h', label: '4小时', minutes: 240 },
  { key: '1d', label: '日线', minutes: 1440 },
  { key: '1w', label: '周线', minutes: 10080 },
  { key: '1M', label: '月线', minutes: 43200 },
];

// ========== 策略状态 ==========

export const STRATEGY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  backtesting: { label: '回测中', color: 'processing' },
  simulating: { label: '模拟中', color: 'blue' },
  live: { label: '实盘中', color: 'green' },
  paused: { label: '已暂停', color: 'warning' },
  archived: { label: '已归档', color: 'default' },
};

// ========== 回测状态 ==========

export const BACKTEST_STATUS_MAP: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'warning' },
};

// ========== 订单状态 ==========

export const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: '已创建', color: 'default' },
  submitted: { label: '已提交', color: 'processing' },
  partial_filled: { label: '部分成交', color: 'blue' },
  filled: { label: '全部成交', color: 'success' },
  cancelled: { label: '已撤销', color: 'warning' },
  expired: { label: '已过期', color: 'default' },
  rejected: { label: '已拒绝', color: 'error' },
};

// ========== 风险等级 ==========

export const RISK_LEVEL_MAP: Record<string, { label: string; color: string }> = {
  safe: { label: '安全', color: '#26A69A' },
  warning: { label: '警告', color: '#FF9800' },
  danger: { label: '危险', color: '#EF5350' },
};

// ========== API 路径（对齐后端 /api/v1） ==========

export const API_PATHS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH_TOKEN: '/auth/refresh',
  LOGOUT: '/auth/logout',
  SESSIONS: '/auth/sessions',
  REVOKE_SESSION: '/auth/sessions/{id}',

  // Users
  USER_ME: '/users/me',
  USER_CHANGE_PASSWORD: '/users/me/password',
  USER_AUDIT_LOGS: '/users/audit-logs',

  // Data（行情+下载）
  DATA_EXCHANGES: '/data/exchanges',
  DATA_TICKER: '/data/ticker/{exchange}/{symbol}',
  DATA_ORDERBOOK: '/data/orderbook/{exchange}/{symbol}',
  DATA_KLINES: '/data/klines/{exchange}/{symbol}',
  DATA_FUNDING_RATE: '/data/funding-rate/{exchange}/{symbol}',
  DATA_AGGREGATED: '/data/aggregated/{symbol}',
  DATA_DOWNLOAD: '/data/download',

  // Strategies
  STRATEGIES: '/strategies/',
  STRATEGY_DETAIL: '/strategies/{id}',
  STRATEGY_CLONE: '/strategies/{id}/clone',
  STRATEGY_VERSIONS: '/strategies/{id}/versions',
  STRATEGY_ROLLBACK: '/strategies/{id}/versions/{v}/rollback',
  STRATEGY_EXPORT_CODE: '/strategies/{id}/export-code',
  STRATEGY_TEMPLATES: '/strategies/templates',

  // Backtest
  BACKTESTS: '/backtest/',
  BACKTEST_DETAIL: '/backtest/{id}',
  BACKTEST_CANCEL: '/backtest/{id}/cancel',
  BACKTEST_REPORT: '/backtest/{id}/report',
  BACKTEST_OPTIMIZE: '/backtest/optimize',
  BACKTEST_OPTIMIZE_DETAIL: '/backtest/optimize/{id}',

  // Simulation
  SIM_ACCOUNTS: '/simulation/accounts',
  SIM_ACCOUNT_DETAIL: '/simulation/accounts/{id}',
  SIM_ACCOUNT_RESET: '/simulation/accounts/{id}/reset',
  SIM_ACCOUNT_PAUSE: '/simulation/accounts/{id}/pause',
  SIM_ACCOUNT_RESUME: '/simulation/accounts/{id}/resume',
  SIM_ACCOUNT_START: '/simulation/accounts/{id}/start',
  SIM_ACCOUNT_STOP: '/simulation/accounts/{id}/stop',
  SIM_ACCOUNT_STATUS: '/simulation/accounts/{id}/status',
  SIM_ACCOUNT_TRADES: '/simulation/accounts/{id}/trades',
  SIM_LIVE_READINESS: '/simulation/accounts/{id}/live-readiness',

  // Trading
  TRADING_API_KEYS: '/trading/api-keys',
  TRADING_API_KEY_DETAIL: '/trading/api-keys/{id}',
  TRADING_ORDERS: '/trading/orders',
  TRADING_ORDER_SUBMIT: '/trading/orders/{id}/submit',
  TRADING_ORDER_DETAIL: '/trading/orders/{id}',
  TRADING_POSITIONS: '/trading/positions',
  TRADING_LOGS: '/trading/logs',

  // Risk
  RISK_RULES: '/risk/rules',
  RISK_RULE_DETAIL: '/risk/rules/{id}',
  RISK_CIRCUIT_BREAKERS: '/risk/circuit-breakers',
  RISK_RESOLVE_BREAKER: '/risk/circuit-breakers/{id}/resolve',
  RISK_PRE_CHECK: '/risk/pre-check',
  RISK_CHECK_POSITION: '/risk/check-position',
  RISK_DASHBOARD: '/risk/dashboard',
  RISK_EVENTS: '/risk/events',
  RISK_BLACKLIST: '/risk/blacklist',

  // AI（智能分析）
  AI_HEALTH_SCORE: '/ai/strategies/{id}/health-score',
  AI_OVERFIT_RISK: '/ai/strategies/{id}/overfit-risk',
  AI_MARKET_FIT: '/ai/strategies/{id}/market-fit',
  AI_PARAM_SUGGESTIONS: '/ai/strategies/{id}/param-suggestions',
  AI_MARKET_STATE: '/ai/market/state',
  AI_CORRELATION: '/ai/market/correlation',
  AI_ALLOCATION: '/ai/portfolio/allocation',

  // Notifications
  NOTIFICATIONS_RULES: '/notifications/rules',
  NOTIFICATIONS_RULE_DETAIL: '/notifications/rules/{id}',
  NOTIFICATIONS_MESSAGES: '/notifications/messages',
  NOTIFICATIONS_MESSAGE_READ: '/notifications/messages/{id}/read',
  NOTIFICATIONS_READ_ALL: '/notifications/messages/read-all',
  NOTIFICATIONS_PREFERENCES: '/notifications/preferences',

  // Admin
  ADMIN_HEALTH: '/admin/health',
  ADMIN_EXCHANGE_STATUS: '/admin/exchanges/status',
  ADMIN_STRATEGIES_RUNNING: '/admin/strategies/running',
  ADMIN_CONFIG: '/admin/config',
} as const;

/** 后端 API 版本前缀（baseURL） */
export const API_BASE_URL = '/api/v1';

// ========== 配置常量 ==========

export const CONFIG = {
  // Token
  TOKEN_KEY: 'quant_access_token',
  REFRESH_TOKEN_KEY: 'quant_refresh_token',
  TOKEN_EXPIRY_KEY: 'quant_token_expiry',
  REMEMBER_ME_DAYS: 7,

  // WebSocket
  WS_RECONNECT_BASE_MS: 1000,
  WS_RECONNECT_MAX_MS: 30000,
  WS_HEARTBEAT_INTERVAL_MS: 30000,

  // API
  API_TIMEOUT_MS: 15000,
  STALE_TIME_MS: 30000,

  // 风控
  LIQUIDATION_WARNING_THRESHOLD: 0.3,
  LIQUIDATION_DANGER_THRESHOLD: 0.1,

  // 锁屏
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_DURATION_MINUTES: 15,

  // 回测
  MAX_CHART_DATA_POINTS: 5000,
} as const;

// ========== 策略节点分类 ==========

export const NODE_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'indicator', label: '技术指标', icon: '📊' },
  { key: 'price_pattern', label: '价格形态', icon: '📈' },
  { key: 'volume', label: '成交量', icon: '📉' },
  { key: 'orderbook', label: '订单簿', icon: '🔍' },
  { key: 'derivatives', label: '衍生品数据', icon: '💰' },
  { key: 'math', label: '数学运算', icon: '🧮' },
  { key: 'comparison', label: '比较逻辑', icon: '🔀' },
  { key: 'logic', label: '逻辑组合', icon: '🔗' },
  { key: 'action', label: '下单动作', icon: '🎯' },
  { key: 'risk', label: '风控动作', icon: '🛡️' },
];

// ========== 导航菜单 ==========

export interface NavItem {
  key: string;
  label: string;
  path?: string;
  icon?: string;
  children?: NavItem[];
  roles?: string[];
}

export const MAIN_NAV: NavItem[] = [
  { key: 'dashboard', label: '仪表盘', path: '/', icon: 'DashboardOutlined' },
  { key: 'market', label: '行情', path: '/market', icon: 'StockOutlined' },
  {
    key: 'strategy',
    label: '策略',
    icon: 'CodeOutlined',
    children: [
      { key: 'strategy-list', label: '策略列表', path: '/strategy' },
      { key: 'strategy-visual', label: '可视化编辑器', path: '/strategy/visual/new' },
      { key: 'strategy-code', label: '代码编辑器', path: '/strategy/code/new' },
    ],
  },
  { key: 'backtest', label: '回测', path: '/backtest', icon: 'BarChartOutlined' },
  {
    key: 'trade',
    label: '交易',
    icon: 'DollarOutlined',
    children: [
      { key: 'sim', label: '模拟交易', path: '/sim' },
      { key: 'live', label: '实盘交易', path: '/trade', roles: ['advanced_user'] },
      { key: 'funding-rate', label: '资金费率', path: '/trade/funding-rate' },
      { key: 'order-routing', label: '订单路由', path: '/trade/order-routing', roles: ['advanced_user'] },
    ],
  },
  { key: 'risk', label: '风控', path: '/risk', icon: 'SafetyOutlined' },
  { key: 'analysis', label: '分析', path: '/analysis', icon: 'BulbOutlined' },
  { key: 'data', label: '数据', path: '/data', icon: 'DatabaseOutlined' },
];

// ========== 侧边栏子导航（按当前模块） ==========

export const SIDEBAR_MENUS: Record<string, NavItem[]> = {
  dashboard: [],
  market: [
    { key: 'market-overview', label: '行情总览', path: '/market' },
    { key: 'market-watchlist', label: '自选', path: '/market?filter=watchlist' },
  ],
  strategy: [
    { key: 'strategy-list', label: '策略列表', path: '/strategy' },
    { key: 'strategy-visual', label: '新建可视化策略', path: '/strategy/visual/new' },
    { key: 'strategy-code', label: '新建代码策略', path: '/strategy/code/new' },
  ],
  backtest: [
    { key: 'backtest-list', label: '回测任务', path: '/backtest' },
    { key: 'backtest-new', label: '新建回测', path: '/backtest/new' },
    { key: 'backtest-portfolio', label: '组合回测', path: '/backtest/portfolio' },
  ],
  trade: [
    { key: 'sim', label: '模拟总览', path: '/sim' },
    { key: 'live', label: '实盘总览', path: '/trade' },
    { key: 'funding-rate', label: '资金费率', path: '/trade/funding-rate' },
    { key: 'order-routing', label: '订单路由', path: '/trade/order-routing' },
  ],
  risk: [
    { key: 'risk-overview', label: '风控总览', path: '/risk' },
  ],
  analysis: [
    { key: 'analysis-overview', label: '策略诊断', path: '/analysis' },
    { key: 'analysis-correlation', label: '山寨币关联', path: '/analysis/correlation' },
  ],
  data: [
    { key: 'data-download', label: '数据下载', path: '/data' },
    { key: 'data-webhooks', label: 'Webhook 管理', path: '/data/webhooks' },
  ],
};
