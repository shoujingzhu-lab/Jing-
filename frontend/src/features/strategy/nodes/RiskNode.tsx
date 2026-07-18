import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { WarningOutlined } from '@ant-design/icons';
import NodeWrapper from './NodeWrapper';
import type { StrategyNodeData } from '@/stores/strategyStore';

function RiskNode({ id, data, selected }: NodeProps<StrategyNodeData>) {
  const { label, category, description, params } = data;

  const pct = params?.pct;
  const isHighRisk = pct && Number(pct) > 20;

  return (
    <NodeWrapper
      id={id}
      label={label}
      category={category}
      description={description}
      selected={selected}
      inputHandles={['input']}
      outputHandles={['output']}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {pct !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
            {String(params?.type === 'trailing' ? '追踪' : '固定')} {String(pct)}%
          </span>
        )}
        {isHighRisk && (
          <WarningOutlined style={{ color: 'var(--red-trade)', fontSize: 12 }} />
        )}
      </div>
    </NodeWrapper>
  );
}

export default memo(RiskNode);
