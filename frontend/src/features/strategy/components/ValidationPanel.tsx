import { Alert, Space } from 'antd';
import { useStrategyStore } from '@/stores/strategyStore';

interface ValidationPanelProps {
  /** 点击错误时选中对应节点 */
  onSelectNode?: (nodeId: string) => void;
}

/**
 * ValidationPanel — 策略验证面板
 *
 * 显示当前策略图的验证错误和警告，点击可跳转到对应节点。
 */
export default function ValidationPanel({ onSelectNode }: ValidationPanelProps) {
  const validationErrors = useStrategyStore((s) => s.validationErrors);
  const validationWarnings = useStrategyStore((s) => s.validationWarnings);
  const selectNode = useStrategyStore((s) => s.selectNode);

  if (validationErrors.length === 0 && validationWarnings.length === 0) {
    return (
      <Alert
        message="策略验证通过"
        type="success"
        showIcon
        style={{
          background: 'rgba(38, 166, 154, 0.08)',
          borderColor: 'rgba(38, 166, 154, 0.2)',
        }}
      />
    );
  }

  const handleClick = (nodeId?: string) => {
    if (nodeId) {
      selectNode(nodeId);
      onSelectNode?.(nodeId);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      {/* 错误 */}
      {validationErrors.map((err, i) => (
        <Alert
          key={`err-${i}`}
          message={err.message}
          type="error"
          showIcon
          style={{
            background: 'rgba(239, 83, 80, 0.08)',
            borderColor: 'rgba(239, 83, 80, 0.2)',
            cursor: err.nodeId ? 'pointer' : 'default',
          }}
          onClick={() => handleClick(err.nodeId)}
        />
      ))}

      {/* 警告 */}
      {validationWarnings.map((w, i) => (
        <Alert
          key={`warn-${i}`}
          message={w}
          type="warning"
          showIcon
          style={{
            background: 'rgba(255, 152, 0, 0.08)',
            borderColor: 'rgba(255, 152, 0, 0.2)',
          }}
        />
      ))}
    </Space>
  );
}
