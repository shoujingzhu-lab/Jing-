interface ProgressBarProps {
  /** 进度百分比 (0-100) */
  percent: number;
  /** 状态色 */
  status?: 'active' | 'success' | 'warning' | 'error';
  /** 是否显示百分比文本 */
  showInfo?: boolean;
  /** 高度 */
  strokeWidth?: number;
  /** 进度条标签 */
  label?: string;
  /** 动画 */
  animated?: boolean;
  style?: React.CSSProperties;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--brand)',
  success: 'var(--green-trade)',
  warning: 'var(--warning)',
  error: 'var(--red-trade)',
};

/**
 * ProgressBar — 动画进度条
 *
 * 用于回测进度、数据下载、任务执行等场景。
 */
export default function ProgressBar({
  percent,
  status = 'active',
  showInfo = true,
  strokeWidth = 6,
  label,
  animated = true,
  style,
}: ProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const color = STATUS_COLORS[status] || STATUS_COLORS.active;

  return (
    <div style={{ width: '100%', ...style }}>
      {/* 标签行 */}
      {(label || showInfo) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          {label && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {label}
            </span>
          )}
          {showInfo && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {clampedPercent.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* 进度条轨道 */}
      <div
        style={{
          width: '100%',
          height: strokeWidth,
          background: 'var(--bg-tertiary)',
          borderRadius: strokeWidth / 2,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 进度条填充 */}
        <div
          style={{
            width: `${clampedPercent}%`,
            height: '100%',
            background: status === 'error'
              ? color
              : `linear-gradient(90deg, ${color}, ${color}dd)`,
            borderRadius: strokeWidth / 2,
            transition: animated ? 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            position: 'relative',
          }}
        >
          {/* 动画光泽 (仅 active 状态) */}
          {animated && status === 'active' && (
            <div
              className="skeleton-shimmer"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.3,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
