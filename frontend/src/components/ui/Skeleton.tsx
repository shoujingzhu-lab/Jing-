import { Skeleton as AntSkeleton } from 'antd';

type SkeletonType = 'card' | 'table' | 'chart' | 'text';

interface SkeletonProps {
  type?: SkeletonType;
  rows?: number;
  animated?: boolean;
}

export default function Skeleton({ type = 'card', rows, animated = true }: SkeletonProps) {
  switch (type) {
    case 'card':
      return (
        <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <AntSkeleton active={animated} paragraph={{ rows: 2 }} />
        </div>
      );

    case 'table':
      return (
        <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <AntSkeleton active={animated} title paragraph={{ rows: rows || 8 }} />
        </div>
      );

    case 'chart':
      return (
        <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <AntSkeleton.Input active={animated} style={{ width: '100%', height: 300 }} />
        </div>
      );

    case 'text':
      return <AntSkeleton active={animated} paragraph={{ rows: rows || 1 }} />;

    default:
      return <AntSkeleton active={animated} paragraph={{ rows: rows || 3 }} />;
  }
}
