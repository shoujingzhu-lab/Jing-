import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import NodeWrapper from './NodeWrapper';
import type { StrategyNodeData } from '@/stores/strategyStore';

function IndicatorNode({ id, data, selected }: NodeProps<StrategyNodeData>) {
  const { label, category, description, params } = data;

  // 构建参数摘要
  const paramSummary = params
    ? Object.entries(params)
        .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
        .slice(0, 3)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : '';

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
      {paramSummary && (
        <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)', marginBottom: 2 }}>
          {paramSummary}
        </div>
      )}
    </NodeWrapper>
  );
}

export default memo(IndicatorNode);
