import { Card, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { formatNumber } from '@/lib/utils/format';
import { ANIMATION_VARIANTS, staggerStyle } from '@/lib/utils/animation';

interface MetricCardProps {
  /** 指标标签 */
  label: string;
  /** 主值 */
  value: number | string;
  /** 前缀（如 $） */
  prefix?: string;
  /** 后缀（如 %） */
  suffix?: string;
  /** 快捷格式化 */
  format?: 'usdt' | 'percent' | 'number';
  /** 趋势方向 */
  trend?: 'up' | 'down' | 'flat';
  /** 趋势数值 */
  trendValue?: string;
  /** 副标题/辅助信息 */
  subtitle?: string;
  /** 迷你图表 */
  miniChart?: React.ReactNode;
  /** 卡片变体 */
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  /** 加载中 */
  loading?: boolean;
  /** 列表交错动画索引 */
  staggerIndex?: number;
  /** 点击回调 */
  onClick?: () => void;
  /** 自定义样式 */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MetricCard — 高级金融数据展示卡片
 *
 * 用于仪表盘、策略详情、回测报告、风控面板等场景。
 * 替代 ad-hoc 的带数字 Card 布局。
 */
export default function MetricCard({
  label,
  value,
  prefix,
  suffix,
  format,
  trend,
  trendValue,
  subtitle,
  miniChart,
  variant = 'default',
  loading = false,
  staggerIndex = 0,
  onClick,
  className,
  style,
}: MetricCardProps) {
  const trendIcon =
    trend === 'up' ? <ArrowUpOutlined /> :
    trend === 'down' ? <ArrowDownOutlined /> :
    <MinusOutlined />;

  const trendColor =
    trend === 'up' ? 'var(--green-trade)' :
    trend === 'down' ? 'var(--red-trade)' :
    'var(--text-secondary)';

  const formatValue = (val: number | string, fmt?: string): string => {
    if (typeof val === 'string') return val;
    if (fmt === 'usdt') return `$${formatNumber(val)}`;
    if (fmt === 'percent') return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    return formatNumber(val);
  };

  const displayValue = format ? formatValue(value, format) :
    (typeof value === 'number' ? formatNumber(value) : value);

  // 变体样式
  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-card)',
    },
    elevated: {
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-elevated)',
    },
    bordered: {
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    },
    glass: {
      background: 'rgba(22, 27, 34, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid var(--border-color)',
    },
  };

  const cardStyle: React.CSSProperties = {
    ...variantStyles[variant],
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    ...staggerStyle(staggerIndex),
    ...style,
  };

  return (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      className={`metric-card ${className ?? ''}`}
      style={cardStyle}
      styles={{ body: { padding: '16px 20px' } }}
      loading={loading}
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
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 标签 */}
          <Typography.Text
            style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {label}
          </Typography.Text>

          {/* 主值 */}
          <div
            className={ANIMATION_VARIANTS.countUp}
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: '2px 0',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.3,
            }}
          >
            {prefix}{displayValue}{suffix}
          </div>

          {/* 趋势 + 副标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {trend && (
              <span style={{ color: trendColor, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 2 }}>
                {trendIcon} {trendValue}
              </span>
            )}
            {subtitle && (
              <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                {subtitle}
              </Typography.Text>
            )}
          </div>
        </div>

        {/* 迷你图表 */}
        {miniChart && (
          <div style={{ flexShrink: 0, marginLeft: 12 }}>
            {miniChart}
          </div>
        )}
      </div>
    </Card>
  );
}
