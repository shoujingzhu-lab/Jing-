import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import NodeWrapper from './NodeWrapper';
import type { StrategyNodeData } from '@/stores/strategyStore';

const LOGIC_SYMBOLS: Record<string, string> = {
  and: '&',
  or: '||',
  not: '!',
};

function LogicNode({ id, data, selected }: NodeProps<StrategyNodeData>) {
  const { label, category, description, type } = data;
  const symbol = LOGIC_SYMBOLS[type] || type;

  return (
    <NodeWrapper
      id={id}
      label={label}
      category={category}
      description={description}
      selected={selected}
      inputHandles={type === 'not' ? ['input'] : ['a', 'b']}
      outputHandles={['output']}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}
      >
        {symbol}
      </div>
    </NodeWrapper>
  );
}

export default memo(LogicNode);
