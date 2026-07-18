import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import NodeWrapper from './NodeWrapper';
import type { StrategyNodeData } from '@/stores/strategyStore';

const OPERATOR_SYMBOLS: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '=',
  gte: '≥',
  lte: '≤',
};

function ComparisonNode({ id, data, selected }: NodeProps<StrategyNodeData>) {
  const { label, category, description, params } = data;
  const op = params?.operator ? OPERATOR_SYMBOLS[String(params.operator)] || String(params.operator) : '';
  const threshold = params?.threshold;

  return (
    <NodeWrapper
      id={id}
      label={label}
      category={category}
      description={description}
      selected={selected}
      inputHandles={['a', 'b']}
      outputHandles={['output']}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>A</span>
        <span style={{ fontWeight: 700, color: 'var(--brand)', fontSize: 14 }}>{op}</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {threshold !== undefined ? String(threshold) : 'B'}
        </span>
      </div>
    </NodeWrapper>
  );
}

export default memo(ComparisonNode);
