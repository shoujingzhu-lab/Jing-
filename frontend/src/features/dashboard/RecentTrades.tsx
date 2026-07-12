import { Card, List, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
import { formatRelativeTime, formatCryptoAmount } from '@/lib/utils/format';
import type { RecentTradeItem } from '@/hooks/useDashboard';

interface Props {
  data?: RecentTradeItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function RecentTrades({ data, loading, error, onRetry }: Props) {
  if (error) return <ErrorBoundaryCard error={error} onRetry={onRetry} />;
  if (loading) return <Skeleton type="card" />;

  return (
    <Card
      title="最近成交"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      styles={{ body: { padding: '0 16px' } }}
    >
      <List
        dataSource={data || []}
        renderItem={(item) => {
          const isBuy = item.side === 'buy';
          return (
            <List.Item
              style={{
                borderBottom: '1px solid var(--border-color)',
                padding: '10px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div>
                  <Tag color={isBuy ? 'green' : 'red'} style={{ margin: 0, marginRight: 8 }}>
                    {isBuy ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {isBuy ? '买入' : '卖出'}
                  </Tag>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontWeight: 600 }}>
                    {item.symbol}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontSize: 13 }}>
                    ${item.price.toLocaleString()} × {formatCryptoAmount(item.quantity)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {formatRelativeTime(item.time)}
                  </div>
                </div>
              </div>
            </List.Item>
          );
        }}
        locale={{ emptyText: '暂无成交记录' }}
      />
    </Card>
  );
}
