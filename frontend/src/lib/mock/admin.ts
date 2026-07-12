import type {
  SystemHealth,
  ServiceStatus,
  ExchangeStatus,
  SystemTask,
  BacktestQueueItem,
  SystemAlertRule,
  User,
  Notification,
  NotificationPreference,
  PriceAlert,
} from '@/lib/types';

// ========== 系统健康 ==========

export function mockSystemHealth(): SystemHealth {
  return {
    cpuUsage: 42.5,
    memoryUsage: 68.2,
    diskUsage: 55.8,
    onlineUsers: 128,
    todayOrders: 1520,
    anomalyEvents: 3,
    activeAlerts: 2,
  };
}

// ========== 服务状态 ==========

export function mockServices(): ServiceStatus[] {
  return [
    { name: 'API Gateway', status: 'online', uptime: '15d 8h 22m', cpuUsage: 32, memoryUsage: 45 },
    { name: '回测引擎-1', status: 'online', uptime: '8d 12h 10m', cpuUsage: 78, memoryUsage: 62 },
    { name: '回测引擎-2', status: 'online', uptime: '8d 12h 10m', cpuUsage: 65, memoryUsage: 58 },
    { name: '行情采集器-Binance', status: 'online', uptime: '15d 8h 22m', cpuUsage: 15, memoryUsage: 28 },
    { name: '行情采集器-OKX', status: 'degraded', uptime: '15d 8h 20m', cpuUsage: 22, memoryUsage: 35 },
    { name: '行情采集器-Bybit', status: 'online', uptime: '15d 8h 22m', cpuUsage: 18, memoryUsage: 30 },
    { name: '通知服务', status: 'online', uptime: '15d 8h 22m', cpuUsage: 8, memoryUsage: 22 },
    { name: 'WebSocket Hub', status: 'online', uptime: '6d 4h 15m', cpuUsage: 25, memoryUsage: 40 },
  ];
}

// ========== 交易所状态 ==========

export function mockExchangeStatus(): ExchangeStatus[] {
  return [
    {
      exchange: 'binance',
      restLatency: 85,
      wsStatus: 'connected',
      successRate24h: 0.998,
      rateLimitUsage: 0.45,
    },
    {
      exchange: 'okx',
      restLatency: 120,
      wsStatus: 'reconnecting',
      successRate24h: 0.992,
      rateLimitUsage: 0.38,
      lastAnomaly: 'WebSocket 间歇性断开，正在自动重连',
    },
    {
      exchange: 'bybit',
      restLatency: 95,
      wsStatus: 'connected',
      successRate24h: 0.997,
      rateLimitUsage: 0.32,
    },
    {
      exchange: 'gate',
      restLatency: 150,
      wsStatus: 'connected',
      successRate24h: 0.995,
      rateLimitUsage: 0.25,
    },
  ];
}

// ========== 定时任务 ==========

export function mockSystemTasks(): SystemTask[] {
  return [
    {
      id: 'task-001',
      name: '每日数据归档',
      description: '将昨日行情数据压缩归档至冷存储',
      cronExpression: '0 2 * * *',
      lastRunTime: '2026-06-07T02:00:05Z',
      lastDuration: 320,
      nextRunTime: '2026-06-08T02:00:00Z',
      status: 'running',
    },
    {
      id: 'task-002',
      name: '策略绩效汇总',
      description: '计算所有活跃策略的日/周/月绩效指标',
      cronExpression: '0 1 * * *',
      lastRunTime: '2026-06-07T01:00:12Z',
      lastDuration: 485,
      nextRunTime: '2026-06-08T01:00:00Z',
      status: 'running',
    },
    {
      id: 'task-003',
      name: '资金费率快照',
      description: '每小时记录各交易所资金费率',
      cronExpression: '0 * * * *',
      lastRunTime: '2026-06-07T11:00:03Z',
      lastDuration: 15,
      nextRunTime: '2026-06-07T12:00:00Z',
      status: 'running',
    },
    {
      id: 'task-004',
      name: '自动备份数据库',
      description: '全量备份 PostgreSQL 数据库',
      cronExpression: '0 3 * * 0',
      lastRunTime: '2026-06-01T03:00:45Z',
      lastDuration: 1820,
      nextRunTime: '2026-06-08T03:00:00Z',
      status: 'paused',
    },
    {
      id: 'task-005',
      name: '过期 Token 清理',
      description: '清理过期 Refresh Token 和 API Key',
      cronExpression: '0 4 * * *',
      lastRunTime: '2026-06-07T04:00:08Z',
      lastDuration: 42,
      nextRunTime: '2026-06-08T04:00:00Z',
      status: 'running',
    },
  ];
}

// ========== 回测队列 ==========

export function mockBacktestQueue(): BacktestQueueItem[] {
  return [
    {
      id: 'queue-001',
      userId: 'user-005',
      userName: '李明',
      strategyName: 'EMA金叉策略',
      params: 'BTC/USDT, fast=12, slow=26, 2025/01-2026/06',
      submittedAt: '2026-06-07T08:15:00Z',
      queueTime: '2m 30s',
      estimatedDuration: '~3min',
      status: 'running',
      priority: 5,
    },
    {
      id: 'queue-002',
      userId: 'user-012',
      userName: '王芳',
      strategyName: '多因子选币',
      params: 'BTC,ETH,SOL/USDT, 2025/01-2026/06',
      submittedAt: '2026-06-07T10:45:00Z',
      queueTime: '15m',
      estimatedDuration: '~8min',
      status: 'queued',
      priority: 3,
    },
    {
      id: 'queue-003',
      userId: 'user-003',
      userName: '张伟',
      strategyName: 'RSI超卖反弹',
      params: 'ETH/USDT, period=14, 2025/03-2026/05',
      submittedAt: '2026-06-07T11:00:00Z',
      queueTime: '0m',
      estimatedDuration: '~2min',
      status: 'queued',
      priority: 2,
    },
  ];
}

// ========== 系统告警规则 ==========

export function mockAlertRules(): SystemAlertRule[] {
  return [
    {
      id: 'rule-001',
      name: 'CPU 使用率告警',
      condition: 'cpu_usage > 90% 持续 5min',
      severity: 'warning',
      notifyTarget: 'admin+运维钉钉群',
      cooldown: 600,
      enabled: true,
    },
    {
      id: 'rule-002',
      name: '回测引擎离线',
      condition: 'backtest_engine_status = offline 持续 2min',
      severity: 'critical',
      notifyTarget: 'admin+电话告警',
      cooldown: 120,
      enabled: true,
    },
    {
      id: 'rule-003',
      name: '数据库连接池耗尽',
      condition: 'db_connections > 90% 持续 1min',
      severity: 'serious',
      notifyTarget: 'admin+钉钉+邮件',
      cooldown: 300,
      enabled: true,
    },
    {
      id: 'rule-004',
      name: 'API 成功率下降',
      condition: 'api_success_rate < 95% 持续 10min',
      severity: 'warning',
      notifyTarget: 'admin钉钉群',
      cooldown: 600,
      enabled: false,
    },
  ];
}

// ========== 用户列表（管理后台） ==========

export function mockUsers(): User[] {
  return [
    { id: 'user-001', email: 'admin@quant.com', nickname: '超级管理员', role: 'admin', twoFactorEnabled: true, createdAt: '2024-06-01T00:00:00Z' },
    { id: 'user-002', email: 'trader1@quant.com', nickname: '高级交易员', role: 'advanced_user', twoFactorEnabled: true, createdAt: '2024-08-15T10:30:00Z' },
    { id: 'user-003', email: 'reviewer@quant.com', nickname: '策略审核员', role: 'strategy_reviewer', twoFactorEnabled: false, createdAt: '2024-10-01T08:00:00Z' },
    { id: 'user-004', email: 'user1@quant.com', nickname: '普通用户A', role: 'user', twoFactorEnabled: false, createdAt: '2025-01-15T14:20:00Z' },
    { id: 'user-005', email: 'user2@quant.com', nickname: '普通用户B', role: 'user', twoFactorEnabled: true, createdAt: '2025-03-20T09:45:00Z' },
    { id: 'user-006', email: 'trader2@quant.com', nickname: '交易员C', role: 'advanced_user', twoFactorEnabled: true, createdAt: '2025-05-10T16:30:00Z' },
  ];
}

// ========== 通知 ==========

export function mockNotifications(): Notification[] {
  return [
    {
      id: 'notif-001',
      type: 'alert',
      title: '止损触发',
      summary: 'BTC/USDT 触发止损，价格 $44,200',
      content: '策略 EMA金叉策略 在 Binance 上的 BTC/USDT 仓位触发止损。平仓价格：$44,200，亏损：-$158.30。',
      time: '2026-06-07T09:15:00Z',
      read: false,
      actions: [{ label: '查看详情', action: 'view_detail', payload: { strategyId: 'strat-001' } }],
    },
    {
      id: 'notif-002',
      type: 'trade',
      title: '止盈执行',
      summary: 'BNB/USDT 触发止盈，盈利 $1,520.80',
      content: '布林带突破策略止盈平仓 BNB/USDT，盈利 $1,520.80（+8.5%）',
      time: '2026-06-07T06:45:00Z',
      read: false,
    },
    {
      id: 'notif-003',
      type: 'system',
      title: '回测完成',
      summary: 'EMA金叉策略回测已完成',
      content: '您的 BTC/USDT 回测任务已完成。总收益：+38.45%，Sharpe：1.85，最大回撤：-15.2%',
      time: '2026-06-07T05:30:00Z',
      read: true,
      actions: [{ label: '查看报告', action: 'view_report', payload: { backtestId: 'bt-001' } }],
    },
    {
      id: 'notif-004',
      type: 'data',
      title: '数据下载就绪',
      summary: 'ETH/USDT K线数据已打包完成',
      content: '您请求的 ETH/USDT 2025年全年1小时K线数据已生成，格式：CSV，大小：45MB。下载链接有效期24小时。',
      time: '2026-06-06T18:20:00Z',
      read: true,
      actions: [{ label: '下载', action: 'download', payload: { taskId: 'dl-001' } }],
    },
    {
      id: 'notif-005',
      type: 'alert',
      title: '强平预警',
      summary: 'DOGE/USDT 保证金率降至 12%',
      content: '你持有的 DOGE/USDT 仓位保证金率已降至 12%，距强平价 7.7%。建议尽快追加保证金或减仓。',
      time: '2026-06-07T09:30:00Z',
      read: false,
      actions: [
        { label: '追加保证金', action: 'add_margin', payload: { positionId: 'pos-004' } },
        { label: '平仓', action: 'close_position', payload: { positionId: 'pos-004' } },
      ],
    },
  ];
}

// ========== 通知偏好 ==========

export function mockNotificationPreferences(): NotificationPreference[] {
  return [
    { type: 'alert', channels: ['site', 'email', 'telegram'], enabled: true },
    { type: 'system', channels: ['site', 'email'], enabled: true },
    { type: 'trade', channels: ['site', 'telegram'], enabled: true },
    { type: 'data', channels: ['site'], enabled: false },
  ];
}

// ========== 价格告警 ==========

export function mockPriceAlerts(): PriceAlert[] {
  return [
    {
      id: 'alert-001',
      symbol: 'BTC/USDT',
      condition: 'gte',
      targetPrice: 50000,
      currentPrice: 46800,
      channels: ['site', 'email'],
      enabled: true,
    },
    {
      id: 'alert-002',
      symbol: 'ETH/USDT',
      condition: 'lte',
      targetPrice: 3000,
      currentPrice: 3150,
      channels: ['site', 'telegram'],
      enabled: true,
    },
    {
      id: 'alert-003',
      symbol: 'SOL/USDT',
      condition: 'gte',
      targetPrice: 200,
      currentPrice: 192,
      channels: ['site'],
      enabled: true,
      triggeredAt: '2026-06-05T14:30:00Z',
    },
  ];
}
