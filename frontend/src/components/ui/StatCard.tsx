import { Card, Typography, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { formatNumber } from '@/lib/utils/format';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  loading?: boolean;
  /** 快捷格式化：usdt → $1,234.56, percent → 12.3%, number → 1,234 */
  format?: 'usdt' | 'percent' | 'number';
  /** 迷你图表数据 */
  miniChart?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

function formatValue(value: number | string, fmt?: string): string {
  if (typeof value === 'string') return value;
  if (fmt === 'usdt') return `$${formatNumber(value)}`;
  if (fmt === 'percent') return `${value.toFixed(1)}%`;
  return formatNumber(value);
}

export default function StatCard({
  title,
  value,
  prefix,
  suffix,
  trend,
  trendValue,
  loading,
  format,
  miniChart,
  onClick,
  style,
}: StatCardProps) {
  const trendIcon = trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />;
  const trendColor = trend === 'up' ? 'var(--green-trade)' : trend === 'down' ? 'var(--red-trade)' : 'var(--text-secondary)';

  if (loading) {
    return (
      <Card style={style} bordered={false}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  const displayValue = format ? formatValue(value, format) : (typeof value === 'number' ? formatNumber(value) : value);

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        ...style,
      }}
      bodyStyle={{ padding: '16px 20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {title}
          </Typography.Text>
          <div style={{ fontSize: 24, fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {prefix}
            {displayValue}
            {suffix}
          </div>
          {trend && (
            <span style={{ color: trendColor, fontSize: 13 }}>
              {trendIcon} {trendValue}
            </span>
          )}
        </div>
        {miniChart && <div>{miniChart}</div>}
      </div>
    </Card>
  );
}
