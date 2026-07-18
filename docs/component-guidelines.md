# 组件设计规范

## 目录结构

```
src/
├── components/          # 共享 UI 组件
│   ├── ui/              #   原子组件 (StatCard, StatusTag, Skeleton...)
│   ├── Layout/          #   布局组件 (Header, Sidebar, Footer...)
│   ├── Chart/           #   图表组件
│   ├── Form/            #   表单组件
│   └── Table/           #   表格组件
├── features/            # 业务功能模块
│   └── <feature>/       #   每个功能模块独立目录
│       ├── components/  #     功能专属组件
│       └── hooks/       #     功能专属 Hooks
├── pages/               # 页面入口组件 (路由级别)
├── stores/              # Zustand 全局状态
├── hooks/               # 全局通用 Hooks
└── lib/                 # 工具库
    ├── api/             #   API 服务层
    ├── mock/            #   Mock 数据
    ├── utils/           #   工具函数
    ├── types/           #   类型定义
    └── constants/       #   常量定义
```

## 组件 API 设计

### Props 接口

- 每个组件导出 `interface XxxProps`，命名规则：`<ComponentName>Props`
- 使用 TypeScript 严格类型，避免 `any`
- 可选属性用 `?` 标记
- 复杂组件提供 `variant` 属性控制视觉变体

```tsx
// ✅ 推荐
interface StatCardProps {
  title: string;
  value: number | string;
  loading?: boolean;
  trend?: 'up' | 'down' | 'flat';
  variant?: 'default' | 'elevated' | 'glass';
}
```

### 命名规范

- 组件文件：PascalCase（`StatCard.tsx`）
- Hook 文件：camelCase，`use` 前缀（`useStrategy.ts`）
- 工具函数：camelCase（`formatNumber.ts`）
- 事件处理函数：`handle` 前缀（`handleSave`, `handleDelete`）
- 布尔值：`is`/`has`/`should` 前缀（`isLoading`, `hasError`）

## 样式规范

### 优先级

1. **Ant Design 组件 token** — 通过 `ConfigProvider` theme 配置
2. **CSS 变量** — `var(--bg-secondary)` 等，支持暗色/亮色主题
3. **Tailwind 工具类** — 简单场景用 `className`（如 `.text-green`, `.card-base`）
4. **内联 style** — 仅用于动态计算值

### 禁止事项

- ❌ CSS Modules（项目不使用）
- ❌ styled-components（未引入依赖）
- ❌ 在组件中定义 `<style>` 标签
- ❌ 硬编码颜色值（始终用 CSS 变量或 Tailwind 类）

### 共享 CSS 类（定义于 `src/styles/index.css`）

| 类名 | 用途 |
|------|------|
| `.card-base` | 基础卡片背景+边框 |
| `.card-base.card-hover` | 悬停时金色边框+上浮 |
| `.card-glass` | 毛玻璃效果背景 |
| `.text-green` / `.text-red` | 涨/跌文字颜色 |
| `.bg-green-transparent` / `.bg-red-transparent` | 涨/跌半透明背景 |
| `.font-mono` / `.mono` / `.tabular-nums` | 等宽数字字体 |
| `.animate-fade-in` | 淡入动画 |
| `.animate-slide-up` | 上滑入动画 |
| `.animate-page-enter` | 页面入场动画 |

## 状态处理

每个数据驱动的组件**必须**处理三种状态：

```tsx
// ✅ 完整的状态处理
function MyDataComponent() {
  const { data, isLoading, isError, refetch } = useQuery(...);

  if (isLoading) return <Skeleton type="card" />;
  if (isError) return <ErrorBoundaryCard error="加载失败" onRetry={refetch} />;
  if (!data?.length) return <EmptyState title="暂无数据" />;
  return <div>{/* 正常渲染 */}</div>;
}
```

### 可用组件

- **Loading**: `<Skeleton type="card|table|chart|stat-card|metric-row" />`
- **Error**: `<ErrorBoundaryCard error={...} onRetry={...} />`
- **Empty**: `<EmptyState title="..." description="..." actionText="..." onAction={...} />`

## 导出规范

- 组件使用 `export default function`
- 类型使用 `export interface`（具名导出）
- 工具模块使用命名导出 + `export default` 对象
