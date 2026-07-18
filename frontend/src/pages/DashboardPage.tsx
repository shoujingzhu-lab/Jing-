import { useEffect } from 'react';
import { Alert, Row, Col } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Typography } from 'antd';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import GlassCard from '@/components/ui/GlassCard';
import GlassButton from '@/components/ui/GlassButton';
import { useDashboard } from '@/hooks/useDashboard';
import OverviewCards from '@/features/dashboard/OverviewCards';
import EquityCurveChart from '@/features/dashboard/EquityCurveChart';
import StrategyStatusTable from '@/features/dashboard/StrategyStatusTable';
import RecentTrades from '@/features/dashboard/RecentTrades';
import MarketSnapshot from '@/features/dashboard/MarketSnapshot';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useDashboard();

  useEffect(() => {
    const timer = setInterval(() => {
      refresh(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  // 新用户引导 — 玻璃风格
  if (!loading && data && !data.hasStrategies) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <span style={{ fontSize: 72, filter: 'drop-shadow(0 0 20px rgba(0, 212, 255, 0.3))' }}>🚀</span>
        <Typography.Title level={3} style={{ color: 'var(--text-primary)', marginTop: 20 }}>
          欢迎使用量化交易系统
        </Typography.Title>
        <Typography.Paragraph style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32 }}>
          你还没有策略，创建第一个策略开始你的量化交易之旅
        </Typography.Paragraph>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <GlassButton variant="primary" onClick={() => navigate('/strategy/visual/new')}>
            可视化策略编辑器
          </GlassButton>
          <GlassButton variant="secondary" onClick={() => navigate('/strategy/code/new')}>
            代码策略编辑器
          </GlassButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>
        仪表盘
      </Typography.Title>

      {/* 风控告警横幅 — 玻璃风格 */}
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="⚠ 风控提示：今日累计亏损已达日内限额的 60%，请注意风险"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          closable
          style={{
            background: 'rgba(255,152,0,0.08)',
            borderColor: 'rgba(255,152,0,0.25)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
          }}
        />
      </div>

      {/* 概览卡片 */}
      <ErrorBoundary>
        <GlassCard variant="elevated" staggerIndex={0}>
          <div style={{ padding: 4 }}>
            <OverviewCards
              data={data ? {
                totalAsset: data.totalAsset,
                todayPnl: data.todayPnl,
                todayPnlPercent: data.todayPnlPercent,
                winRate: data.winRate,
                activeStrategies: data.activeStrategies,
              } : undefined}
              loading={loading}
              error={error}
              onRetry={refresh}
            />
          </div>
        </GlassCard>
      </ErrorBoundary>

      {/* 资产曲线 — 玻璃面板 */}
      <div style={{ marginTop: 16 }}>
        <ErrorBoundary>
          <GlassCard variant="panel" staggerIndex={1}>
            <EquityCurveChart
              data={data?.equityCurve}
              loading={loading}
              error={null}
              onRetry={refresh}
            />
          </GlassCard>
        </ErrorBoundary>
      </div>

      {/* 策略状态 + 最近成交 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={15}>
          <ErrorBoundary>
            <GlassCard variant="panel" staggerIndex={2}>
              <StrategyStatusTable
                data={data?.strategies}
                loading={loading}
                error={null}
                onRetry={refresh}
                onNewStrategy={() => navigate('/strategy/visual/new')}
              />
            </GlassCard>
          </ErrorBoundary>
        </Col>
        <Col xs={24} lg={9}>
          <ErrorBoundary>
            <GlassCard variant="panel" staggerIndex={3}>
              <RecentTrades
                data={data?.recentTrades}
                loading={loading}
                error={null}
                onRetry={refresh}
              />
            </GlassCard>
          </ErrorBoundary>
        </Col>
      </Row>

      {/* 行情快照 */}
      <div style={{ marginTop: 16 }}>
        <ErrorBoundary>
          <GlassCard variant="panel" staggerIndex={4}>
            <MarketSnapshot
              data={data?.marketSnapshot}
              loading={loading}
              error={null}
              onRetry={refresh}
            />
          </GlassCard>
        </ErrorBoundary>
      </div>
    </div>
  );
}
