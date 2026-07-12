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

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  success: { color: 'green', icon: <CheckCircleOutlined /> },
  processing: { color: 'blue', icon: <SyncOutlined spin /> },
  error: { color: 'red', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  default: { color: 'default', icon: <MinusCircleOutlined /> },
  blue: { color: 'blue', icon: <CheckCircleOutlined /> },
  green: { color: 'green', icon: <CheckCircleOutlined /> },
  pending: { color: 'default', icon: <ClockCircleOutlined /> },
};

const PULSE_STYLE: React.CSSProperties = {
  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
};

export default function StatusTag({ status, label, statusMap, animate, style }: StatusTagProps) {
  // 如果提供了 statusMap，从映射中解析 label 和颜色状态
  let resolvedLabel: string = label || status;
  let resolvedStatus: string = status;
  let resolvedColor: string | undefined;

  if (statusMap && statusMap[status]) {
    const entry = statusMap[status];
    resolvedLabel = entry.label;
    if (entry.color) resolvedColor = entry.color;
    else resolvedStatus = 'default';
  }

  const config = STATUS_CONFIG[resolvedStatus] || STATUS_CONFIG.default;

  return (
    <Tag
      icon={config.icon}
      color={resolvedColor || config.color}
      style={{
        margin: 0,
        ...(animate ? PULSE_STYLE : {}),
        ...style,
      }}
    >
      {resolvedLabel}
    </Tag>
  );
}
