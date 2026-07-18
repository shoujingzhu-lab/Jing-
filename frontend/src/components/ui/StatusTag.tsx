import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

type StatusType = 'success' | 'processing' | 'error' | 'warning' | 'default' | 'blue' | 'green';

interface StatusMapEntry { label: string; color?: string }

interface StatusTagProps {
  status: string;
  label?: string;
  /** 备选：通过 status→{label,color} 映射查找 */
  statusMap?: Record<string, StatusMapEntry>;
  /** 是否显示脉冲动画 */
  animate?: boolean;
  style?: React.CSSProperties;
}

/** 需要脉冲动画的状态 */
const PULSE_STATUSES = new Set(['processing', 'backtesting', 'simulating']);

/** 内置状态配置 — 覆盖了后端/业务常用状态 */
const BUILTIN_STATUS: Record<string, { color: string; icon: React.ReactNode }> = {
  success: { color: 'green', icon: <CheckCircleOutlined /> },
  processing: { color: 'blue', icon: <SyncOutlined spin /> },
  error: { color: 'red', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  default: { color: 'default', icon: <MinusCircleOutlined /> },
  blue: { color: 'blue', icon: <CheckCircleOutlined /> },
  green: { color: 'green', icon: <CheckCircleOutlined /> },
  pending: { color: 'default', icon: <ClockCircleOutlined /> },
};

export default function StatusTag({ status, label, statusMap, animate, style }: StatusTagProps) {
  let resolvedLabel: string = label || status;
  let resolvedStatus: string = status;
  let resolvedColor: string | undefined;

  if (statusMap && statusMap[status]) {
    const entry = statusMap[status];
    resolvedLabel = entry.label;
    if (entry.color) resolvedColor = entry.color;
    else resolvedStatus = 'default';
  }

  const config = BUILTIN_STATUS[resolvedStatus] || BUILTIN_STATUS.default;
  const shouldPulse = animate && PULSE_STATUSES.has(status);

  return (
    <Tag
      icon={config.icon}
      color={resolvedColor || config.color}
      style={{
        margin: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        ...style,
      }}
    >
      {/* 动画状态脉冲点 */}
      {shouldPulse && (
        <span
          className="animate-pulse-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {resolvedLabel}
    </Tag>
  );
}
