# Jing- 量化交易系统

全栈量化交易平台 — 可视化策略编辑 · 回测引擎 · 模拟/实盘交易 · 风控面板 · AI 分析

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2 | UI 框架 |
| TypeScript | 6.0 | 类型安全 |
| Vite | 8.0 | 构建工具 |
| Ant Design | 6.4 | 组件库 |
| Tailwind CSS | 3.4 | 工具类样式 |
| ReactFlow | 11.11 | 可视化策略编辑器 |
| Monaco Editor | 0.55 | 代码策略编辑器 |
| ECharts | 6.1 | 图表 |
| Zustand | 5.0 | 状态管理 |
| TanStack Query | 5.101 | 服务端状态 |
| i18next | 26.3 | 国际化 |

### 后端
| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| SQLAlchemy | ORM |
| Alembic | 数据库迁移 |
| Celery | 异步任务 |
| Redis | 缓存/消息队列 |
| WebSocket | 实时推送 |

## 快速开始

### 环境要求

- Node.js ≥ 18
- Python ≥ 3.11
- PostgreSQL ≥ 15
- Redis ≥ 7

### 前端启动

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python run.py      # http://localhost:8000
```

### 一键启动

```bash
# macOS/Linux/Git Bash
./start.sh

# Windows
start.bat
```

## 项目结构

```
jing/
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── components/         #   共享 UI 组件
│   │   │   ├── ui/             #     原子组件 (StatCard, StatusTag, Skeleton...)
│   │   │   ├── Layout/         #     布局 (Header, Sidebar, Footer)
│   │   │   ├── Chart/          #     图表 (BaseChart)
│   │   │   ├── Form/           #     表单 (AmountInput)
│   │   │   └── Table/          #     表格 (DataTable)
│   │   ├── features/           #   业务功能模块
│   │   │   ├── strategy/       #     策略编辑器
│   │   │   │   ├── components/ #       策略功能组件
│   │   │   │   ├── hooks/      #       策略 Hooks
│   │   │   │   └── nodes/      #       ReactFlow 自定义节点
│   │   │   └── dashboard/      #     仪表盘组件
│   │   ├── pages/              #   42 个路由页面
│   │   ├── stores/             #   Zustand 状态管理 (7 stores)
│   │   ├── hooks/              #   全局 Hooks
│   │   ├── router/             #   路由配置 + AuthGuard
│   │   ├── lib/                #   工具库
│   │   │   ├── api/            #     API 服务层 (12 个 service)
│   │   │   ├── mock/           #     Mock 数据 (4 个域)
│   │   │   ├── utils/          #     工具函数
│   │   │   ├── types/          #     TypeScript 类型 (738行)
│   │   │   ├── constants/      #     常量/配置
│   │   │   └── ws/             #     WebSocket 管理器
│   │   ├── tokens/             #   设计 Token 系统
│   │   ├── styles/             #   全局样式 + Ant Design 主题
│   │   └── i18n/               #   国际化 (zh-CN / en-US)
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── api/                #   REST API 路由
│   │   ├── models/             #   SQLAlchemy 模型
│   │   ├── services/           #   业务逻辑层
│   │   ├── engine/             #   回测/模拟引擎
│   │   ├── execution/          #   订单执行管道
│   │   ├── risk/               #   风控模块
│   │   ├── notification/       #   通知渠道 (Email/Telegram/Webhook)
│   │   ├── adapters/           #   交易所适配器
│   │   ├── ai/                 #   AI 分析模块
│   │   └── ws/                 #   WebSocket
│   └── alembic/                #   数据库迁移
├── docker/                     # Docker 部署
├── docs/                       # 开发文档
├── start.sh / start.bat        # 一键启动脚本
└── README.md
```

## 前端页面 (42 页)

| 模块 | 页面 | 状态 |
|------|------|------|
| 认证 | Login, Register, ForgotPassword | ✅ |
| 仪表盘 | Dashboard | ✅ |
| 行情 | Market, MarketDetail | ✅ |
| 策略 | 列表, 详情, 可视化编辑器, 代码编辑器 | ✅ |
| 回测 | 列表, 新建, 报告, 组合回测, 组合报告 | ✅ |
| 模拟 | 概览, 账户详情 | ✅ |
| 交易 | 主面板, 账户详情, 资金费率, 路由 | ✅ |
| 风控 | RiskPanel | ✅ |
| 分析 | 总览, 策略诊断, 山寨币关联 | ✅ |
| 数据中心 | 下载, Webhook | ✅ |
| 通知 | 列表, 价格告警 | ✅ |
| 设置 | 个人设置, API Key | ✅ |
| 管理 | 仪表盘, 用户, 交易所, 系统, 任务, 回测队列, 告警规则, 审计 | ✅ |

## 设计系统

本项目使用统一的设计 Token 系统（`src/tokens/index.ts`），确保视觉一致性：
- 暗色/亮色双主题，CSS 变量驱动
- 4px 基准间距系统
- JetBrains Mono 等宽数字字体
- GitHub 暗色风格配色灵感
- Ant Design + Tailwind + CSS 变量三轨统一

详见 [设计 Token 参考](docs/design-tokens.md)

## npm scripts

```bash
npm run dev          # 启动开发服务器 (port 3000)
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run lint         # ESLint 检查
```

## 开发规范

- [组件设计规范](docs/component-guidelines.md)
- [设计 Token 参考](docs/design-tokens.md)
- [API 集成规范](docs/api-integration.md)
- [编码规范](docs/coding-standards.md)

## License

Private — All rights reserved.
