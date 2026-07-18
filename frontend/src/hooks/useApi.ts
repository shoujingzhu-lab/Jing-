/**
 * 统一 API Query Hooks
 * 基于 TanStack Query，替换原有 Mock 数据
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  authApi, userApi, dataApi, strategyApi, backtestApi,
  simApi, tradingApi, riskApi, aiApi, notificationApi, adminApi,
} from '@/lib/api';
import type {
  LoginRequest, RegisterRequest, PageParams, Strategy,
  BacktestTask, BacktestReport, TradingAccount, Position,
  Order, Trade, RiskEvent, Notification, StrategyHealth,
  MarketState,
} from '@/lib/types';

// ========== Auth ==========

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data).then((r) => r.data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refreshToken: string) => authApi.logout(refreshToken).then((r) => r.data),
    onSuccess: () => {
      qc.clear();
    },
  });
}

// ========== Users ==========

export function useCurrentUser() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe().then((r) => r.data),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAuditLogs(params?: PageParams & { action?: string }) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => userApi.getAuditLogs(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ========== Market Data ==========

export function useExchanges() {
  return useQuery({
    queryKey: ['exchanges'],
    queryFn: () => dataApi.getExchanges().then((r) => r.data),
    staleTime: 300_000,
  });
}

export function useTicker(exchange: string, symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['ticker', exchange, symbol],
    queryFn: () => dataApi.getTicker(exchange, symbol).then((r) => r.data),
    enabled: !!exchange && !!symbol && enabled,
    staleTime: 10_000,
  });
}

export function useOrderBook(exchange: string, symbol: string, depth = 20) {
  return useQuery({
    queryKey: ['orderbook', exchange, symbol, depth],
    queryFn: () => dataApi.getOrderBook(exchange, symbol, depth).then((r) => r.data),
    enabled: !!exchange && !!symbol,
    staleTime: 5_000,
  });
}

export function useKlines(
  exchange: string,
  symbol: string,
  interval = '1h',
  limit = 500,
  enabled = true,
) {
  return useQuery({
    queryKey: ['klines', exchange, symbol, interval, limit],
    queryFn: () => dataApi.getKlines(exchange, symbol, interval, limit).then((r) => r.data),
    enabled: !!exchange && !!symbol && enabled,
    staleTime: 30_000,
  });
}

export function useFundingRate(exchange: string, symbol: string) {
  return useQuery({
    queryKey: ['funding-rate', exchange, symbol],
    queryFn: () => dataApi.getFundingRate(exchange, symbol).then((r) => r.data),
    enabled: !!exchange && !!symbol,
    staleTime: 30_000,
  });
}

export function useAggregatedMarket(symbol: string) {
  return useQuery({
    queryKey: ['aggregated', symbol],
    queryFn: () => dataApi.getAggregated(symbol).then((r) => r.data),
    enabled: !!symbol,
    staleTime: 10_000,
  });
}

// ========== Strategies ==========

export function useStrategyList(params?: PageParams & { status?: string; strategy_type?: string; search?: string }) {
  return useQuery({
    queryKey: ['strategies', params],
    queryFn: () => strategyApi.getList(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useStrategyDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['strategy', id],
    queryFn: () => strategyApi.getDetail(id!).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useStrategyTemplates() {
  return useQuery({
    queryKey: ['strategy-templates'],
    queryFn: () => strategyApi.getTemplates().then((r) => r.data),
    staleTime: 300_000,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => strategyApi.create(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      strategyApi.update(id, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => strategyApi.delete(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

export function useCloneStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      strategyApi.clone(id, name).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

// ========== Backtest ==========

export function useBacktestList(params?: PageParams & { status?: string }) {
  return useQuery({
    queryKey: ['backtests', params],
    queryFn: () => backtestApi.getList(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useBacktestDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest', id],
    queryFn: () => backtestApi.getDetail(id!).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useBacktestReport(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest-report', id],
    queryFn: () => backtestApi.getReport(id!).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateBacktest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      backtestApi.create(config).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtests'] });
    },
  });
}

export function useCancelBacktest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backtestApi.cancel(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtests'] });
    },
  });
}

// ========== Simulation ==========

export function useSimAccounts() {
  return useQuery({
    queryKey: ['sim-accounts'],
    queryFn: () => simApi.getAccounts().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSimAccountDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['sim-account', id],
    queryFn: () => simApi.getAccount(id!).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useSimAccountTrades(id: string | undefined, params?: PageParams) {
  return useQuery({
    queryKey: ['sim-trades', id, params],
    queryFn: () => simApi.getTrades(id!, params).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useSimEngineStatus(id: string | undefined) {
  return useQuery({
    queryKey: ['sim-engine-status', id],
    queryFn: () => simApi.getStatus(id!).then((r) => r.data),
    enabled: !!id,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useLiveReadiness(id: string | undefined) {
  return useQuery({
    queryKey: ['live-readiness', id],
    queryFn: () => simApi.checkLiveReadiness(id!).then((r) => r.data),
    enabled: !!id,
  });
}

// ========== Trading ==========

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => tradingApi.getApiKeys().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => tradingApi.getPositions().then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useOrders(params?: PageParams & { status?: string }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => tradingApi.getOrders(params).then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useTradeLogs(params?: PageParams & { symbol?: string; strategy_id?: string }) {
  return useQuery({
    queryKey: ['trade-logs', params],
    queryFn: () => tradingApi.getLogs(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ========== Risk ==========

export function useRiskRules() {
  return useQuery({
    queryKey: ['risk-rules'],
    queryFn: () => riskApi.getRules().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useRiskDashboard() {
  return useQuery({
    queryKey: ['risk-dashboard'],
    queryFn: () => riskApi.getDashboard().then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useRiskEvents(params?: PageParams) {
  return useQuery({
    queryKey: ['risk-events', params],
    queryFn: () => riskApi.getEvents(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCircuitBreakers() {
  return useQuery({
    queryKey: ['circuit-breakers'],
    queryFn: () => riskApi.getCircuitBreakers().then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useRiskBlacklist() {
  return useQuery({
    queryKey: ['risk-blacklist'],
    queryFn: () => riskApi.getBlacklist().then((r) => r.data),
    staleTime: 60_000,
  });
}

// ========== AI / Analysis ==========

export function useStrategyHealth(strategyId: string | undefined) {
  return useQuery({
    queryKey: ['strategy-health', strategyId],
    queryFn: () => aiApi.getHealthScore(strategyId!).then((r) => r.data),
    enabled: !!strategyId,
  });
}

export function useOverfitRisk(strategyId: string | undefined) {
  return useQuery({
    queryKey: ['overfit-risk', strategyId],
    queryFn: () => aiApi.getOverfitRisk(strategyId!).then((r) => r.data),
    enabled: !!strategyId,
  });
}

export function useMarketFit(strategyId: string | undefined) {
  return useQuery({
    queryKey: ['market-fit', strategyId],
    queryFn: () => aiApi.getMarketFit(strategyId!).then((r) => r.data),
    enabled: !!strategyId,
  });
}

export function useParamSuggestions(strategyId: string | undefined) {
  return useQuery({
    queryKey: ['param-suggestions', strategyId],
    queryFn: () => aiApi.getParamSuggestions(strategyId!).then((r) => r.data),
    enabled: !!strategyId,
  });
}

export function useMarketState() {
  return useQuery({
    queryKey: ['market-state'],
    queryFn: () => aiApi.getMarketState().then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useAltcoinCorrelation() {
  return useQuery({
    queryKey: ['altcoin-correlation'],
    queryFn: () => aiApi.getCorrelation().then((r) => r.data),
    staleTime: 120_000,
  });
}

export function usePortfolioAllocation(strategyIds?: string) {
  return useQuery({
    queryKey: ['portfolio-allocation', strategyIds],
    queryFn: () => aiApi.getAllocation(strategyIds).then((r) => r.data),
    staleTime: 60_000,
  });
}

// ========== Notifications ==========

export function useNotificationRules() {
  return useQuery({
    queryKey: ['notification-rules'],
    queryFn: () => notificationApi.getRules().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useNotificationMessages(params?: PageParams & { category?: string; unread_only?: boolean }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.getMessages(params).then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationApi.getPreferences().then((r) => r.data),
    staleTime: 120_000,
  });
}

// ========== Admin ==========

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => adminApi.getHealth().then((r) => r.data),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useExchangeConnections() {
  return useQuery({
    queryKey: ['exchange-connections'],
    queryFn: () => adminApi.getExchangeStatus().then((r) => r.data),
    staleTime: 10_000,
  });
}

export function useRunningStrategies() {
  return useQuery({
    queryKey: ['running-strategies'],
    queryFn: () => adminApi.getRunningStrategies().then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin-config'],
    queryFn: () => adminApi.getConfig().then((r) => r.data),
    staleTime: 120_000,
  });
}
