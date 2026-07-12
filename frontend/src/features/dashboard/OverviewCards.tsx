import { Row, Col } from 'antd';
import StatCard from '@/components/ui/StatCard';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
import { formatUSDT, formatPercent } from '@/lib/utils/format';

interface OverviewData {
  totalAsset: number;
  todayPnl: number;
  todayPnlPercent: number;
  winRate: number;
  activeStrategies: number;
}

interface Props {
  data?: OverviewData;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function OverviewCards({ data, loading, error, onRetry }: Props) {
  if (error) {
    return <ErrorBoundaryCard error={error} onRetry={onRetry} />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        {loading ? (
          <Skeleton type="card" />
        ) : (
          <StatCard
            title="总资产 (USDT)"
            value={data ? formatUSDT(data.totalAsset) : '--'}
            trend={data && data.todayPnlPercent > 0 ? 'up' : 'down'}
            trendValue={data ? formatPercent(data.todayPnlPercent) : undefined}
          />
        )}
      </Col>
      <Col xs={24} sm={12} lg={6}>
        {loading ? (
          <Skeleton type="card" />
        ) : (
          <StatCard
            title="今日盈亏"
            value={data ? formatUSDT(data.todayPnl) : '--'}
            trend={data && data.todayPnl > 0 ? 'up' : data?.todayPnl && data.todayPnl < 0 ? 'down' : 'flat'}
            trendValue={data ? formatPercent(data.todayPnlPercent) : undefined}
          />
        )}
      </Col>
      <Col xs={24} sm={12} lg={6}>
        {loading ? (
          <Skeleton type="card" />
        ) : (
          <StatCard title="累计胜率" value={data ? `${data.winRate.toFixed(1)}%` : '--'} />
        )}
      </Col>
      <Col xs={24} sm={12} lg={6}>
        {loading ? (
          <Skeleton type="card" />
        ) : (
          <StatCard title="运行中策略" value={data ? String(data.activeStrategies) : '--'} suffix=" 个" />
        )}
      </Col>
    </Row>
  );
}
