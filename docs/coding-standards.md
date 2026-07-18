# 编码规范

## TypeScript

### 类型定义

```ts
// ✅ interface for object shapes
interface User {
  id: string;
  email: string;
  role: UserRole;
}

// ✅ type for unions / primitives
type UserRole = 'admin' | 'advanced_user' | 'user';
type PageParams = { page: number; pageSize: number };

// ✅ discriminated unions for status
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### 禁止

- ❌ `any`（除非万不得已，需注释说明原因）
- ❌ `as` 类型断言绕过类型检查
- ❌ `@ts-ignore` / `@ts-expect-error`
- ❌ 默认导出 + 命名导出混用（组件用 default，工具用 named）

## React

### 组件

```tsx
// ✅ 函数组件 + 显式 Props 接口
interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export default function MyComponent({ title, onAction }: MyComponentProps) {
  // ...
}
```

### Hooks

- 自定义 Hook 以 `use` 开头
- 使用 `useCallback` 包裹传递给子组件的回调
- 使用 `useMemo` 包裹复杂计算
- 避免在渲染中创建新对象/数组

```tsx
// ✅
const handleClick = useCallback(() => { /* ... */ }, []);
const items = useMemo(() => data.map(transform), [data]);
```

### 状态管理决策树

1. **单个组件内部** → `useState`
2. **父子组件间** → Props 传递
3. **兄弟/跨层级组件** → Zustand
4. **服务端数据** → React Query
5. **URL 状态** → URL params（`useSearchParams`）

## 文件组织

### Import 顺序

```ts
// 1. React 核心
import { useState, useCallback } from 'react';

// 2. 第三方库
import { Card, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

// 3. 内部模块（@ 别名）
import { useAuthStore } from '@/stores/authStore';
import { formatNumber } from '@/lib/utils/format';

// 4. 相对路径导入
import StatCard from '../components/ui/StatCard';
import type { Strategy } from '../lib/types';

// 5. 样式
import './styles.css';
```

### 文件大小

- 组件文件：≤ 300 行
- Hook 文件：≤ 150 行
- 工具函数文件：≤ 200 行
- 超过限制 → 拆分

## 命名

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件 | PascalCase | `StrategyListPage` |
| Hook | camelCase + `use` | `useStrategyList` |
| 事件处理 | `handle` + 动作 | `handleSave`, `handleDelete` |
| 布尔值 | `is`/`has`/`should` | `isLoading`, `hasError` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 类型/接口 | PascalCase | `Strategy`, `BacktestConfig` |

## Git

### Commit 格式

```
<type>: <description>

feat: 添加策略编辑器自定义节点
fix: 修复侧边栏折叠动画卡顿
refactor: 提取设计 Token 到独立模块
docs: 添加组件开发规范
style: 统一卡片阴影变量
```

### 分支

- `master` — 主分支
- `feat/<name>` — 功能分支
- `fix/<name>` — 修复分支
