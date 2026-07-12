import { useNavigate } from 'react-router-dom';
import { Card, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
import EmptyState from '@/components/ui/EmptyState';
import { STRATEGY_STATUS_MAP } from '@/lib/constants';
import { formatPercent } from '@/lib/utils/format';
import type { StrategyStatusItem } from '@/hooks/useDashboard';

interface Props {
  data?: StrategyStatusItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNewStrategy?: () => void;
}

export default function StrategyStatusTable({ data, loading, error, onRetry, onNewStrategy }: Props) {
  const navigate = useNavigate();

  if (error) return <ErrorBoundaryCard error={error} onRetry={onRetry} />;
  if (loading) return <Skeleton type="table" rows={4} />;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="还没有策略"
        description="创建你的第一个量化交易策略"
        actionText="创建策略"
        onAction={onNewStrategy}
      />
    );
  }

  const columns = [
    {
      title: '策略名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: StrategyStatusItem) => (
        <a
          style={{ color: 'var(--text-primary)', fontWeight: 500 }}
          onClick={() => navigate(`/strategy/${record.id}/detail`)}
        >
          {name}
        </a>
      ),
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (s: string) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
          {s}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const config = STRATEGY_STATUS_MAP[status] || { label: status, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '今日收益',
      dataIndex: 'todayReturn',
      key: 'todayReturn',
      width: 100,
      align: 'right' as const,
      render: (val: number) => {
        const isUp = val >= 0;
        return (
          <span style={{ color: isUp ? 'var(--green-trade)' : 'var(--red-trade)', fontFamily: "'JetBrains Mono', monospace" }}>
            {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatPercent(val)}
          </span>
        );
      },
    },
    {
      title: '累计收益',
      dataIndex: 'totalReturn',
      key: 'totalReturn',
      width: 100,
      align: 'right' as const,
      render: (val: number) => {
        const isUp = val >= 0;
        return (
          <span style={{ color: isUp ? 'var(--green-trade)' : 'var(--red-trade)', fontFamily: "'JetBrains Mono', monospace" }}>
            {isUp ? '+' : ''}{val.toFixed(2)}%
          </span>
        );
      },
    },
    {
      title: '运行天数',
      dataIndex: 'runningDays',
      key: 'runningDays',
      width: 80,
      align: 'right' as const,
      render: (d: number) => `${d} 天`,
    },
  ];

  return (
    <Card
      title="运行中策略"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      styles={{ body: { padding: '0 16px 16px' } }}
    >
      <Table<StrategyStatusItem>
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        onRow={(record) => ({
          onClick: () => navigate(`/strategy/${record.id}/detail`),
          style: { cursor: 'pointer' },
        })}
        style={{ background: 'transparent' }}
      />
    </Card>
  );
}
