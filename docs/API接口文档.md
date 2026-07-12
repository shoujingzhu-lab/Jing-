# 量化交易系统 API 接口文档

> **Base URL**: `http://localhost:8000/api/v1`
> **WebSocket**: `ws://localhost:8000/ws`
> **OpenAPI JSON**: `http://localhost:8000/api/openapi.json`
> **Swagger UI**: `http://localhost:8000/api/docs`

---

## 测试账户

| 字段 | 值 |
|------|-----|
| 邮箱 | `demo@quant.com` |
| 用户名 | `demo` |
| 密码 | `demo1234` |

> 使用 `POST /auth/login` 登录获取 Token。

---

## 认证方式

所有需要登录的接口在请求头中携带 JWT：

```
Authorization: Bearer <access_token>
```

Token 通过登录接口获取，access_token 有效期 60 分钟，过期后用 refresh_token 刷新。

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2026-06-08T12:00:00Z"
}
```

### 分页响应

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

### 错误响应

```json
{
  "success": false,
  "code": 422,
  "message": "策略验证失败",
  "detail": "节点图中存在循环引用"
}
```

---

## 一、认证模块 `/auth`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册 | 否 |
| POST | `/auth/login` | 用户登录 | 否 |
| POST | `/auth/refresh` | 刷新令牌 | 否 |
| POST | `/auth/logout` | 登出 | 否 |
| GET | `/auth/sessions` | 查看活跃会话 | 是 |
| DELETE | `/auth/sessions/{id}` | 踢出会话 | 是 |

### POST `/auth/register`
```json
// Request Body
{ "email": "user@example.com", "username": "trader01", "password": "SecureP@ss1" }

// Response 201
{ "success": true, "code": 201, "message": "注册成功", "data": { "user_id": "uuid" } }
```

### POST `/auth/login`
```json
// Request Body
{ "email": "user@example.com", "password": "SecureP@ss1" }

// Response 200
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": { "id": "uuid", "username": "trader01", "email": "user@example.com" }
  }
}
```

### POST `/auth/refresh`
```
Query: ?refresh_token=eyJ...
Response: { "data": { "access_token": "eyJ..." } }
```

---

## 二、用户模块 `/users`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/users/me` | 查看个人信息 | 是 |
| PUT | `/users/me/password` | 修改密码 | 是 |
| GET | `/users/audit-logs` | 审计日志 | 是 |

### PUT `/users/me/password`
```
Query: ?old_password=xxx&new_password=yyy
Response: { "message": "密码已修改" }
```

### GET `/users/audit-logs`
```
Query: ?page=1&page_size=20&action=login
```

---

## 三、数据中心 `/data`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/data/exchanges` | 支持的交易所列表 | 否 |
| GET | `/data/ticker/{exchange}/{symbol}` | 实时行情 | 是 |
| GET | `/data/orderbook/{exchange}/{symbol}` | 订单簿深度 | 是 |
| GET | `/data/klines/{exchange}/{symbol}` | K线数据 | 是 |
| GET | `/data/funding-rate/{exchange}/{symbol}` | 资金费率 | 是 |
| GET | `/data/aggregated/{symbol}` | 多交易所聚合行情 | 是 |
| POST | `/data/download` | 下载历史数据 | 是 |

### GET `/data/klines/{exchange}/{symbol}`
```
Query: ?interval=1h&limit=500
Response: { "data": { "bars": [...], "count": 500 } }
```

### POST `/data/download`
```
Query: ?exchange=binance&symbol=BTCUSDT&interval=1h
       &start_date=2026-01-01T00:00:00&end_date=2026-06-01T00:00:00
       &format=json
```

---

## 四、策略引擎 `/strategies`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/strategies/` | 策略列表（分页/筛选/搜索） | 是 |
| POST | `/strategies/` | 创建策略 | 是 |
| GET | `/strategies/templates` | 系统模板库 | 是 |
| GET | `/strategies/{id}` | 策略详情 | 是 |
| PUT | `/strategies/{id}` | 更新策略 | 是 |
| DELETE | `/strategies/{id}` | 删除策略（软删除） | 是 |
| POST | `/strategies/{id}/clone` | 克隆策略 | 是 |
| GET | `/strategies/{id}/versions` | 版本历史 | 是 |
| POST | `/strategies/{id}/versions/{v}/rollback` | 版本回滚 | 是 |
| POST | `/strategies/{id}/export-code` | 导出 Python 代码 | 是 |

### POST `/strategies/` 创建可视化策略
```json
{
  "name": "Dual EMA Crossover",
  "strategy_type": "visual",
  "description": "双EMA交叉策略",
  "trade_type": "perpetual",
  "kline_interval": "1h",
  "symbol_pool": ["BTCUSDT"],
  "tags": ["trend", "ema"],
  "definition": {
    "nodes": [
      { "id": "e9", "type": "indicator", "subtype": "ema", "params": { "period": 9, "source": "close" } },
      { "id": "e21", "type": "indicator", "subtype": "ema", "params": { "period": 21, "source": "close" } },
      { "id": "c1", "type": "condition", "subtype": "crossover", "params": { "direction": "above" } },
      { "id": "s1", "type": "signal", "subtype": "long_entry", "params": { "logic": "and" } },
      { "id": "a1", "type": "action", "subtype": "market_order", "params": { "side": "buy", "amount_type": "usdt", "amount_value": 100 } },
      { "id": "r1", "type": "risk_control", "subtype": "stop_loss", "params": { "type": "percent", "value": 0.05 } }
    ],
    "edges": [
      { "from": "e9", "to": "c1" }, { "from": "e21", "to": "c1" },
      { "from": "c1", "to": "s1" }, { "from": "s1", "to": "a1" },
      { "from": "a1", "to": "r1" }
    ]
  }
}
```

### 策略生命周期状态
```
draft → backtested → simulated → live → paused → archived
```

### 支持的指标节点（30种）
| 类别 | 指标 |
|------|------|
| 趋势 | sma, ema, macd, adx, parabolic_sar, hma, trix |
| 震荡 | rsi, kdj, cci, stoch_rsi, williams_r, awesome_oscillator |
| 波动 | bollinger_bands, atr, donchian_channel, keltner_channel, historical_volatility, ulcer_index |
| 成交量 | volume_ratio, vwap, obv, cmf, force_index, eom, mfi |
| 统计 | linear_regression_slope, z_score, correlation, ppo |

---

## 五、回测系统 `/backtest`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/backtest/` | 创建回测任务 | 是 |
| GET | `/backtest/` | 回测任务列表 | 是 |
| GET | `/backtest/{id}` | 回测任务详情/进度 | 是 |
| POST | `/backtest/{id}/cancel` | 取消回测 | 是 |
| GET | `/backtest/{id}/report` | 回测报告 | 是 |
| POST | `/backtest/optimize` | 创建参数优化 | 是 |
| GET | `/backtest/optimize` | 优化任务列表 | 是 |
| GET | `/backtest/optimize/{id}` | 优化任务详情 | 是 |

### 回测报告包含
- 核心指标：累计/年化收益率、夏普比率、最大回撤、卡玛比率、胜率、盈亏比、平均持仓时间、交易次数、最大连续亏损
- 图表数据：净值曲线、回撤曲线、日收益、月度热力图
- 交易明细：逐笔记录（时间/方向/价格/数量/手续费/盈亏）
- 基准对比：BTC 持有对比、超额收益、Beta、信息比率

---

## 六、模拟交易 `/simulation`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/simulation/accounts` | 创建模拟账户 | 是 |
| GET | `/simulation/accounts` | 账户列表 | 是 |
| GET | `/simulation/accounts/{id}` | 账户详情 | 是 |
| POST | `/simulation/accounts/{id}/reset` | 重置账户 | 是 |
| DELETE | `/simulation/accounts/{id}` | 删除账户 | 是 |
| POST | `/simulation/accounts/{id}/pause` | 暂停模拟 | 是 |
| POST | `/simulation/accounts/{id}/resume` | 恢复模拟 | 是 |
| **POST** | **`/simulation/accounts/{id}/start`** | **启动模拟引擎** | 是 |
| **POST** | **`/simulation/accounts/{id}/stop`** | **停止模拟引擎** | 是 |
| **GET** | **`/simulation/accounts/{id}/status`** | **引擎运行状态** | 是 |
| GET | `/simulation/accounts/{id}/trades` | 模拟交易记录 | 是 |
| GET | `/simulation/accounts/{id}/live-readiness` | 实盘准入检查 | 是 |

### POST `/simulation/accounts/{id}/start` 启动模拟
```
Query: ?strategy_id=uuid&symbol=BTCUSDT&exchange=binance&kline_interval=1h
Response: { "data": { "running": true, "symbol": "BTCUSDT", "trade_count": 0 } }
```

---

## 七、实盘交易 `/trading`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/trading/api-keys` | 绑定交易所 API Key | 是 |
| GET | `/trading/api-keys` | API Key 列表 | 是 |
| DELETE | `/trading/api-keys/{id}` | 删除 API Key | 是 |
| POST | `/trading/orders` | 创建订单 | 是 |
| GET | `/trading/orders` | 订单列表 | 是 |
| **POST** | **`/trading/orders/{id}/submit`** | **提交订单到交易所** | 是 |
| DELETE | `/trading/orders/{id}` | 撤销订单 | 是 |
| GET | `/trading/positions` | 持仓列表 | 是 |
| GET | `/trading/logs` | 交易日志 | 是 |

### POST `/trading/orders` 手动下单
```
Query: ?api_key_id=uuid&symbol=BTCUSDT&side=buy&order_type=market&amount=0.01
       &leverage=3&price=50000
```

### POST `/trading/orders/{id}/submit` 提交到交易所
将已创建的订单（status=created）提交到交易所执行，自动进行风控检查。

---

## 八、风险控制 `/risk`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/risk/rules` | 创建风控规则 | 是 |
| GET | `/risk/rules` | 风控规则列表 | 是 |
| DELETE | `/risk/rules/{id}` | 删除风控规则 | 是 |
| GET | `/risk/circuit-breakers` | 熔断器列表 | 是 |
| POST | `/risk/circuit-breakers/{id}/resolve` | 解除熔断 | 是 |
| **POST** | **`/risk/pre-check`** | **交易前风控检查** | 是 |
| **POST** | **`/risk/check-position`** | **仓位风险检查** | 是 |
| GET | `/risk/dashboard` | 风控仪表盘 | 是 |
| GET | `/risk/events` | 风控事件日志 | 是 |
| GET | `/risk/blacklist` | 黑名单交易对 | 是 |

### POST `/risk/pre-check` 交易前检查
```
Query: ?strategy_id=uuid&symbol=BTCUSDT&side=buy&amount=0.1&price=50000&leverage=3
Response: { "data": { "passed": true, "reason": "" } }
```

### 风控规则类型
| 类型 | 参数示例 | 说明 |
|------|----------|------|
| stop_loss | `{"type":"percent","value":0.05}` | 5%止损 |
| take_profit | `{"type":"percent","value":0.10}` | 10%止盈 |
| daily_loss_limit | `{"limit":1000,"limit_type":"absolute"}` | 日亏损≤$1000 |
| consecutive_loss_limit | `{"max_count":5}` | 连续亏损≤5次 |
| max_drawdown | `{"max_drawdown":0.30}` | 最大回撤≤30% |
| max_position_pct | `{"max_pct":0.10}` | 单仓位≤10% |

---

## 九、智能分析 `/ai`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/ai/strategies/{id}/health-score` | 策略健康度评分 | 是 |
| GET | `/ai/strategies/{id}/overfit-risk` | 过拟合风险检测 | 是 |
| GET | `/ai/strategies/{id}/market-fit` | 策略-市场适配 | 是 |
| GET | `/ai/strategies/{id}/param-suggestions` | 参数优化建议 | 是 |
| GET | `/ai/market/state` | 市场状态分类 | 是 |
| GET | `/ai/market/correlation` | 山寨币相关性 | 是 |
| GET | `/ai/portfolio/allocation` | 资金分配建议 | 是 |

### GET `/ai/market/state`
```json
{
  "data": {
    "trend": "bullish", "volatility": "medium",
    "regime": "trending_up", "altcoin_season": false,
    "confidence": 0.75,
    "description": "上升趋势 — 趋势跟随策略表现良好"
  }
}
```

---

## 十、通知告警 `/notifications`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/notifications/rules` | 创建告警规则 | 是 |
| GET | `/notifications/rules` | 告警规则列表 | 是 |
| DELETE | `/notifications/rules/{id}` | 删除告警规则 | 是 |
| GET | `/notifications/messages` | 站内消息列表 | 是 |
| PUT | `/notifications/messages/{id}/read` | 标记已读 | 是 |
| POST | `/notifications/messages/read-all` | 全部已读 | 是 |
| GET | `/notifications/preferences` | 通知偏好 | 是 |
| PUT | `/notifications/preferences` | 更新通知偏好 | 是 |

### 通知渠道
`in_app` | `telegram` | `email` | `discord` | `dingtalk`

---

## 十一、系统管理 `/admin`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin/health` | 系统健康检查 | 是 |
| GET | `/admin/exchanges/status` | 交易所连接状态 | 是 |
| GET | `/admin/strategies/running` | 策略运行统计 | 是 |
| GET | `/admin/config` | 全局参数配置 | 是 |

---

## WebSocket 接口

### 行情推送 `ws://localhost:8000/ws/market?token=<jwt>`
```json
// 客户端发送
{ "action": "subscribe", "channel": "ticker:binance:BTCUSDT" }
{ "action": "subscribe", "channel": "klines:binance:BTCUSDT:1h" }
{ "action": "ping" }

// 服务端推送
{ "type": "data", "channel": "ticker:binance:BTCUSDT", "data": {...} }
{ "type": "pong", "data": { "pong": true } }
```

### 用户事件 `ws://localhost:8000/ws/user?token=<jwt>`
自动订阅 `position:{user_id}`, `order:{user_id}`, `risk:{user_id}`, `notification:{user_id}`

---

## 前端接入清单

1. **认证流程**：`POST /auth/login` → 存 access_token + refresh_token → 所有请求带 `Authorization: Bearer <token>`
2. **Token 过期**：调 `POST /auth/refresh?refresh_token=xxx` 无感刷新
3. **策略编辑器**：可视化策略 definition 格式见"策略引擎"章节
4. **实时数据**：行情用 WebSocket `/ws/market`，订单/通知用 `/ws/user`
5. **下单前必调**：`POST /risk/pre-check` 检查风控
6. **OpenAPI JSON**：直接导入 `http://localhost:8000/api/openapi.json` 到前端代码生成工具

---

> 📄 **OpenAPI 3.1 规范文件**：`docs/api-openapi.json`
> 🔗 **Swagger UI**：http://localhost:8000/api/docs
