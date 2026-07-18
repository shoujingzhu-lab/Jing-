import { Skeleton as AntSkeleton } from 'antd';

type SkeletonType = 'card' | 'table' | 'chart' | 'text' | 'stat-card' | 'metric-row';

interface SkeletonProps {
  type?: SkeletonType;
  rows?: number;
  animated?: boolean;
}

/**
 * Skeleton — 骨架屏组件
 *
 * 提供多种变体：card, table, chart, stat-card, metric-row, text。
 * 使用优化后的 CSS shimmer 动画 (transform 而非 background-position)。
 */
export default function Skeleton({ type = 'card', rows, animated = true }: SkeletonProps) {
  const containerStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    padding: 20,
    borderRadius: 8,
    border: '1px solid var(--border-color)',
  };

  switch (type) {
    case 'card':
      return (
        <div style={containerStyle}>
          <AntSkeleton active={animated} paragraph={{ rows: 2 }} />
        </div>
      );

    case 'table':
      return (
        <div style={containerStyle}>
          <AntSkeleton active={animated} title paragraph={{ rows: rows || 8 }} />
        </div>
      );

    case 'chart':
      return (
        <div style={containerStyle}>
          <AntSkeleton.Input active={animated} style={{ width: '100%', height: 300 }} />
        </div>
      );

    case 'stat-card':
      return (
        <div style={containerStyle}>
          <AntSkeleton active={animated} title={{ width: '40%' }} paragraph={{ rows: 1, width: '70%' }} />
          <div style={{ height: 24 }} />
        </div>
      );

    case 'metric-row':
      return (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Array.from({ length: rows || 4 }).map((_, i) => (
            <div key={i} style={{ ...containerStyle, flex: '1 1 200px' }}>
              <AntSkeleton active={animated} title={{ width: '30%' }} paragraph={{ rows: 1, width: '60%' }} />
            </div>
          ))}
        </div>
      );

    case 'text':
      return <AntSkeleton active={animated} paragraph={{ rows: rows || 1 }} />;

    default:
      return <AntSkeleton active={animated} paragraph={{ rows: rows || 3 }} />;
  }
}
