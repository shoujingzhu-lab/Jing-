# 量化交易系统 API 接口文档

**版本**: 0.1.0
**基础 URL**: `http://localhost:8000/api/v1`
**接口总数**: 89 个
**数据模型**: 37 个

---

## 1. 概述

本系统提供 **13 个功能模块** 共 **89 个 RESTful API 接口**，覆盖加密货币量化交易的全流程：
行情获取、策略管理、回测、模拟交易、实盘交易、风控、智能分析、通知告警、系统管理等。

### 1.1 认证方式

除根路径和健康检查外，所有 API 需携带 JWT Token：

```http
Authorization: Bearer <access_token>
```

- `access_token` 通过 `/api/v1/auth/login` 获取，有效期 **60 分钟**
- `refresh_token` 用于刷新 access_token，有效期 **30 天**

### 1.2 通用响应格式

**成功响应**:
```json
{
  "success": true,
  "code": 200,
  "message": "OK",
  "data": { ... },
  "timestamp": "2026-07-18T06:50:00Z"
}
```

**分页响应**:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "code": 502,
  "message": "错误描述",
  "data": null,
  "timestamp": "2026-07-18T06:50:00Z"
}
```

### 1.3 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 / Token 过期 |
| 403 | 没有权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复创建）|
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
| 502 | 外部服务不可用（如交易所 API 故障）|

---

## 2. 根路径 & 系统监控

### 2.1 根路径

```http
GET /
```

返回 API 基本信息。无需认证。

**响应示例**:
```json
{
  "app": "QuantTradingSystem",
  "version": "0.1.0",
  "environment": "development",
  "docs": "/api/docs",
  "health": "/health",
  "metrics": "/metrics"
}
```

### 2.2 健康检查

```http
GET /health
```

返回所有基础设施连接状态。

**响应示例**:
```json
{
  "status": "healthy",
  "app": "QuantTradingSystem",
  "version": "0.1.0",
  "environment": "development",
  "uptime_seconds": 852.1,
  "databases": {
    "main": "connected",
    "timescale": "connected"
  },
  "redis": "connected",
  "timestamp": "2026-07-18T06:50:00Z"
}
```

### 2.3 Kubernetes 探针

| 接口 | 说明 |
|------|------|
| `GET /health/live` | Liveness Probe — 进程存活检查 |
| `GET /health/ready` | Readiness Probe — 服务就绪检查（含 DB 连接检测）|

### 2.4 Prometheus 指标

```http
GET /metrics
```

返回 Prometheus 格式的指标数据（HTTP 请求、交易、数据库、WebSocket 等）。

---

## 3. 认证模块 (Auth)

### 3.1 用户注册

```http
POST /api/v1/auth/register
```

**请求体**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名，3-50 字符 |
| `email` | string | 是 | 邮箱地址 |
| `password` | string | 是 | 密码，最少 8 字符 |

**示例**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@quant.com","password":"Admin123!"}'
```

### 3.2 用户登录

```http
POST /api/v1/auth/login
```

**请求体**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | 是 | 邮箱地址 |
| `password` | string | 是 | 密码 |

**响应**: 返回 `access_token` 和 `refresh_token`。

**示例**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@quant.com","password":"Admin123!"}'
```

### 3.3 刷新 Token

```http
POST /api/v1/auth/refresh
```

使用 refresh_token 获取新的 access_token。

### 3.4 其他认证接口

| 接口 | 说明 |
|------|------|
| `POST /api/v1/auth/logout` | 登出（废弃当前 Token）|
| `GET /api/v1/auth/me` | 获取当前用户信息 |
| `PUT /api/v1/auth/me` | 更新当前用户信息 |

---

## 4. 数据中心 (Data)

> 多交易所实时行情获取、聚合、历史数据下载。支持 Binance / OKX / Bybit / Gate.io。

### 4.1 获取实时行情

```http
GET /api/v1/data/ticker/{exchange}/{symbol}
```

| 参数 | 说明 | 示例 |
|------|------|------|
| `exchange` | 交易所名称 | `okx`, `gateio`, `binance`, `bybit` |
| `symbol` | 交易对 | `BTCUSDT`, `ETHUSDT` |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "last": 63975.9,
    "bid": 63975.8,
    "ask": 63975.9,
    "high_24h": 64391.9,
    "low_24h": 62536.4,
    "volume_24h": 4313.64,
    "quote_volume_24h": 273320303.75,
    "change_pct_24h": 1.70,
    "timestamp": 1784357409464
  }
}
```

```bash
# 获取 OKX BTC/USDT 实时行情
curl "http://localhost:8000/api/v1/data/ticker/okx/BTCUSDT" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.2 获取订单簿深度

```http
GET /api/v1/data/orderbook/{exchange}/{symbol}?depth=20
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `depth` | 深度档位 (1-100) | 20 |

```bash
curl "http://localhost:8000/api/v1/data/orderbook/okx/BTCUSDT?depth=5" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.3 获取 K 线数据

```http
GET /api/v1/data/klines/{exchange}/{symbol}?interval=1h&limit=500
```

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `interval` | K 线周期 | `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w` |
| `limit` | 返回条数 | 1-1000 (默认 500) |
| `since` | 起始时间戳 (ms) | 可选 |

### 4.4 多交易所聚合行情

```http
GET /api/v1/data/aggregated/{symbol}
```

同时获取所有交易所报价，计算最优买卖价和跨所价差。

```bash
curl "http://localhost:8000/api/v1/data/aggregated/BTCUSDT" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.5 其他数据接口

| 接口 | 说明 |
|------|------|
| `GET /api/v1/data/exchanges` | 支持的交易所列表及产品类型 |
| `GET /api/v1/data/funding-rate/{exchange}/{symbol}` | 合约资金费率 |
| `POST /api/v1/data/download` | 下载历史 K 线数据 |

---

## 5. 策略引擎 (Strategies)

> 策略的创建、编辑、版本管理、回滚、系统模板库。生命周期: draft → backtested → simulated → live → paused → archived。

### 5.1 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/strategies` | 获取策略列表（支持分页/筛选）|
| `POST` | `/api/v1/strategies` | 创建新策略 |
| `GET` | `/api/v1/strategies/{id}` | 获取策略详情 |
| `PUT` | `/api/v1/strategies/{id}` | 更新策略 |
| `DELETE` | `/api/v1/strategies/{id}` | 删除策略 |
| `POST` | `/api/v1/strategies/{id}/clone` | 克隆策略 |
| `GET` | `/api/v1/strategies/{id}/versions` | 获取策略版本历史 |
| `POST` | `/api/v1/strategies/{id}/rollback` | 回滚到指定版本 |
| `GET` | `/api/v1/strategies/templates` | 获取系统策略模板（15 个）|
| `POST` | `/api/v1/strategies/export` | 导出策略代码 |

### 5.2 系统策略模板

首次启动时自动播种 15 个策略模板：

| # | 模板名称 | 类型 |
|---|----------|------|
| 1 | 双均线交叉 | 趋势跟踪 |
| 2 | MACD 金叉死叉 | 趋势跟踪 |
| 3 | 布林带突破 | 波动率 |
| 4 | RSI 超买超卖 | 震荡 |
| 5 | 网格交易 | 高频 |
| 6 | 海龟交易法 | 趋势跟踪 |
| 7 | 唐奇安通道 | 趋势跟踪 |
| 8 | KDJ 指标 | 震荡 |
| 9 | EMA 三线 | 趋势跟踪 |
| 10 | VWAP 策略 | 成交量 |
| 11 | OBV 能量潮 | 成交量 |
| 12 | ATR 止损 | 风险管理 |
| 13 | 三角套利 | 套利 |
| 14 | 动量突破 | 趋势跟踪 |
| 15 | 均值回归 | 统计套利 |

---

## 6. 回测系统 (Backtest)

> 事件驱动回测引擎，支持 5 种撮合模式、参数优化、完整绩效报告。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/backtest/run` | 运行单策略回测 |
| `POST` | `/api/v1/backtest/batch` | 批量回测 |
| `POST` | `/api/v1/backtest/optimize` | 参数优化（网格搜索）|
| `GET` | `/api/v1/backtest/tasks` | 回测任务列表 |
| `GET` | `/api/v1/backtest/tasks/{id}` | 回测任务状态 |
| `GET` | `/api/v1/backtest/results/{id}` | 回测结果详情 |
| `GET` | `/api/v1/backtest/results/{id}/report` | 回测报告（PDF/JSON）|
| `GET` | `/api/v1/backtest/results/{id}/equity` | 净值曲线数据 |

> **5 种撮合模式**: next_open, close, limit, VWAP, counterparty
> **绩效指标**: 总收益率、年化收益率、夏普比率、最大回撤、胜率、盈亏比、日均交易次数、月度收益率热力图

---

## 7. 模拟交易 (Simulation)

> 使用真实行情驱动模拟账户，评估策略实盘表现。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/simulation/accounts` | 创建模拟账户 |
| `GET` | `/api/v1/simulation/accounts` | 模拟账户列表 |
| `GET` | `/api/v1/simulation/accounts/{id}` | 账户详情 |
| `POST` | `/api/v1/simulation/accounts/{id}/reset` | 重置账户 |
| `POST` | `/api/v1/simulation/accounts/{id}/deposit` | 充值 |
| `DELETE` | `/api/v1/simulation/accounts/{id}` | 删除账户 |
| `GET` | `/api/v1/simulation/accounts/{id}/performance` | 绩效查看 |
| `GET` | `/api/v1/simulation/accounts/{id}/trades` | 交易记录 |
| `POST` | `/api/v1/simulation/accounts/{id}/start` | 启动模拟 |
| `POST` | `/api/v1/simulation/accounts/{id}/stop` | 停止模拟 |
| `GET` | `/api/v1/simulation/accounts/{id}/check-live` | 实盘准入检查 |
| `GET` | `/api/v1/simulation/trades` | 全部模拟交易记录 |

---

## 8. 实盘交易 (Trading)

> API Key 加密管理、手动下单、订单追踪、持仓管理。

### 8.1 API Key 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/trading/api-keys` | 添加交易所 API Key（AES-256-GCM 加密存储）|
| `GET` | `/api/v1/trading/api-keys` | API Key 列表 |
| `DELETE` | `/api/v1/trading/api-keys/{id}` | 删除 API Key |

### 8.2 订单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/trading/orders` | 提交订单（市价/限价/止损）|
| `GET` | `/api/v1/trading/orders` | 订单列表 |
| `GET` | `/api/v1/trading/orders/{id}` | 订单详情 |
| `DELETE` | `/api/v1/trading/orders/{id}` | 撤单 |

### 8.3 持仓管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/trading/positions` | 持仓列表 |
| `GET` | `/api/v1/trading/positions/{id}` | 持仓详情 |

> **安全机制**: API Key 使用 AES-256-GCM 加密存储，下单前执行幂等检查（防重单）+ 指数退避重试 + 滑点预估。

---

## 9. 风险控制 (Risk)

> 策略级 / 账户级 / 全局三级风控体系，熔断机制。

### 9.1 风控规则

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/risk/rules` | 创建风控规则 |
| `GET` | `/api/v1/risk/rules` | 风控规则列表 |
| `GET` | `/api/v1/risk/rules/{id}` | 规则详情 |
| `PUT` | `/api/v1/risk/rules/{id}` | 更新规则 |
| `DELETE` | `/api/v1/risk/rules/{id}` | 删除规则 |

### 9.2 熔断器

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/risk/circuit-breakers/trigger` | 手动触发熔断 |
| `POST` | `/api/v1/risk/circuit-breakers/release` | 恢复熔断 |
| `GET` | `/api/v1/risk/circuit-breakers` | 熔断器状态列表 |

### 9.3 风控事件

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/risk/events` | 风控事件日志 |
| `GET` | `/api/v1/risk/dashboard` | 风控仪表盘 |

---

## 10. 智能分析 (AI)

> 策略健康度评估、市场状态识别、关联分析、参数建议。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/ai/strategies/{id}/health` | 策略健康度评估 |
| `GET` | `/api/v1/ai/strategies/{id}/diagnosis` | 策略诊断详情 |
| `GET` | `/api/v1/ai/strategies/{id}/market-fit` | 策略-市场适配度 |
| `GET` | `/api/v1/ai/strategies/{id}/parameters/suggest` | 参数优化建议 |
| `GET` | `/api/v1/ai/market/state` | 市场状态分类 |
| `GET` | `/api/v1/ai/market/correlation` | 山寨币关联分析 |
| `GET` | `/api/v1/ai/allocation/suggest` | 资金分配建议 |

---

## 11. 通知告警 (Notifications)

> 策略告警、价格告警、系统告警，支持多渠道推送。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/notifications/rules` | 创建告警规则 |
| `GET` | `/api/v1/notifications/rules` | 告警规则列表 |
| `PUT` | `/api/v1/notifications/rules/{id}` | 更新规则 |
| `DELETE` | `/api/v1/notifications/rules/{id}` | 删除规则 |
| `GET` | `/api/v1/notifications` | 站内消息列表 |
| `GET` | `/api/v1/notifications/unread-count` | 未读消息数 |
| `PUT` | `/api/v1/notifications/{id}/read` | 标记已读 |
| `PUT` | `/api/v1/notifications/read-all` | 全部已读 |
| `GET` | `/api/v1/notifications/preferences` | 通知偏好设置 |

> **推送渠道**: Telegram Bot、Email (SMTP)、站内消息、WebSocket 实时推送

---

## 12. 系统管理 (Admin)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/admin/health/detailed` | 详细健康状态 |
| `GET` | `/api/v1/admin/exchange/status` | 交易所连接状态 |
| `GET` | `/api/v1/admin/strategies/stats` | 策略运行统计 |
| `GET` | `/api/v1/admin/config` | 全局参数配置 |

---

## 13. WebSocket 实时推送

系统提供 WebSocket 连接用于实时数据推送：

| 端点 | 说明 | 推送频率 |
|------|------|----------|
| `ws://host:8000/ws/ticker/{exchange}/{symbol}` | 实时行情推送 | 1 秒 |
| `ws://host:8000/ws/orderbook/{exchange}/{symbol}` | 订单簿深度推送 | 1 秒 |
| `ws://host:8000/ws/klines/{exchange}/{symbol}` | K 线数据推送 | 60 秒 |
| `ws://host:8000/ws/orders` | 订单状态更新推送 | 实时 |
| `ws://host:8000/ws/notifications` | 通知推送 | 实时 |

> 数据来源于交易所实时 API（通过 CCXT），经 DataBroadcaster 后台任务定时轮询后广播给所有订阅客户端。

---

## 14. 真实交易所支持状态

| 交易所 | 行情数据 | 交易功能 | 备注 |
|--------|----------|----------|------|
| **OKX** | ✅ 正常 | ✅ 就绪 | 需要配置 API Key |
| **Gate.io** | ✅ 正常 | ✅ 就绪 | 需要配置 API Key |
| **Binance** | ❌ 地理封锁 | ❌ 地理封锁 | HTTP 451，需特殊网络环境 |
| **Bybit** | ❌ 地理封锁 | ❌ 地理封锁 | CloudFront 403，需特殊网络环境 |

---

## 附录

- **OpenAPI Spec**: [openapi.json](http://localhost:8000/api/openapi.json)
- **Swagger UI**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **ReDoc**: [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc)
- **基础 URL**: `http://localhost:8000/api/v1`
- **项目路径**: `backend/`
- **文档生成时间**: 2026-07-18
- **API 版本**: 0.1.0