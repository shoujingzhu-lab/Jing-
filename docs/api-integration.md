# API 集成规范

## 架构

```
页面组件 → React Query Hook → API Service → Axios Client → 后端
                ↕
          Zustand Store (客户端状态)
```

## API Service 层 (`src/lib/api/`)

### 客户端 (`client.ts`)

- Axios 实例，baseURL: `/api/v1`
- 自动附加 `Authorization: Bearer <token>` 请求头
- 401 响应自动刷新 token（队列机制防止并发刷新）
- 刷新失败清除认证状态并跳转登录页

### Service 对象 (`index.ts`)

每个业务域对应一个 service 对象：

```ts
// 模式
export const strategyApi = {
  getList: (params?) => client.get(API_PATHS.STRATEGIES, { params }),
  getDetail: (id: string) => client.get(`${API_PATHS.STRATEGIES}/${id}`),
  create: (data) => client.post(API_PATHS.STRATEGIES, data),
  update: (id, data) => client.put(`${API_PATHS.STRATEGIES}/${id}`, data),
  delete: (id) => client.delete(`${API_PATHS.STRATEGIES}/${id}`),
  // ...
};
```

**约定**:
- 方法返回 `AxiosResponse`（默认不 unwrap）
- 类型通过泛型标注：`client.get<ApiResponse<Strategy[]>>(...)`
- API path 使用 `API_PATHS` 常量

## React Query 集成

### 查询 (Query)

```ts
import { useQuery } from '@tanstack/react-query';
import { strategyApi } from '@/lib/api';

export function useStrategyList(params?) {
  return useQuery({
    queryKey: ['strategies', params],
    queryFn: () => strategyApi.getList(params).then(r => r.data),
    staleTime: 30_000,  // 30s 内不重新请求
  });
}
```

**约定**:
- `queryKey`: `['resource-name', ...params]`
- `staleTime`: 默认 30s（全局配置）
- 使用 `enabled` 控制条件查询

### 变更 (Mutation)

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => strategyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}
```

**约定**:
- 变更成功后 invalidate 相关 queries
- 乐观更新：先更新缓存，失败后回滚

### 在组件中使用

```tsx
function StrategyListPage() {
  const { data, isLoading, isError, refetch } = useStrategyList();
  const deleteMut = useDeleteStrategy();

  if (isLoading) return <Skeleton type="metric-row" />;
  if (isError) return <ErrorBoundaryCard error="加载失败" onRetry={refetch} />;

  return (/* ... */);
}
```

## Zustand 集成

### 何时使用 Zustand

- ✅ 跨页面/跨组件的客户端状态（用户认证、主题设置、连接状态）
- ✅ 复杂编辑器的状态（策略编辑器节点/边）
- ❌ 服务端数据（用 React Query）

### Store 模式

```ts
import { create } from 'zustand';

interface MyState {
  data: SomeType;
  isLoading: boolean;
  fetchData: () => Promise<void>;
  updateData: (partial: Partial<SomeType>) => void;
}

export const useMyStore = create<MyState>((set, get) => ({
  data: initialData,
  isLoading: false,
  fetchData: async () => {/* ... */},
  updateData: (partial) => set((s) => ({ data: { ...s.data, ...partial } })),
}));
```

## 错误处理

1. **全局**: Axios 拦截器处理 401/网络错误
2. **Query 级别**: `isError` + `ErrorBoundaryCard`
3. **Mutation 级别**: `onError` 回调 + `message.error()`
