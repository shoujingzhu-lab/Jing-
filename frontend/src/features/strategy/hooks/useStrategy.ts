import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { strategyApi } from '@/lib/api';
import type { Strategy } from '@/lib/types';

/** 获取策略列表 */
export function useStrategyList(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: ['strategies', params],
    queryFn: () => strategyApi.getList(params).then((r) => r.data as Strategy[]),
    staleTime: 30_000,
  });
}

/** 获取单个策略详情 */
export function useStrategyDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['strategy', id],
    queryFn: () => strategyApi.getDetail(id!).then((r) => r.data as Strategy),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** 获取策略版本历史 */
export function useStrategyVersions(id: string | undefined) {
  return useQuery({
    queryKey: ['strategy-versions', id],
    queryFn: () => strategyApi.getVersions(id!).then((r) => r.data),
    enabled: !!id,
  });
}

/** 创建策略 */
export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Strategy>) => strategyApi.create(data as Strategy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

/** 更新策略 */
export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Strategy> }) =>
      strategyApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

/** 删除策略 */
export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => strategyApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

/** 回滚策略版本 */
export function useRollbackStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: string }) =>
      strategyApi.rollback(id, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}
