import { Card, Typography, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { formatNumber } from '@/lib/utils/format';
import { ANIMATION_VARIANTS } from '@/lib/utils/animation';

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
  const trendIcon =
    trend === 'up' ? <ArrowUpOutlined /> :
    trend === 'down' ? <ArrowDownOutlined /> :
    <MinusOutlined />;

  const trendColor =
    trend === 'up' ? 'var(--green-trade)' :
    trend === 'down' ? 'var(--red-trade)' :
    'var(--text-secondary)';

  if (loading) {
    return (
      <Card style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        ...style,
      }} bordered={false}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  const displayValue = format
    ? formatValue(value, format)
    : (typeof value === 'number' ? formatNumber(value) : value);

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--shadow-card)',
        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
      styles={{ body: { padding: '16px 20px' } }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--brand)';
        el.style.boxShadow = 'var(--shadow-hover)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border-color)';
        el.style.boxShadow = 'var(--shadow-card)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* 顶部渐变趋势条 */}
      {trend && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: trend === 'up'
              ? 'linear-gradient(90deg, transparent, var(--green-trade), transparent)'
              : trend === 'down'
                ? 'linear-gradient(90deg, transparent, var(--red-trade), transparent)'
                : 'linear-gradient(90deg, transparent, var(--text-secondary), transparent)',
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </Typography.Text>
          <div
            className={ANIMATION_VARIANTS.countUp}
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: '4px 0',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {prefix}
            {displayValue}
            {suffix}
          </div>
          {trend && (
            <span style={{ color: trendColor, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 2 }}>
              {trendIcon} {trendValue}
            </span>
          )}
        </div>
        {miniChart && <div>{miniChart}</div>}
      </div>
    </Card>
  );
}
