import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import NodeWrapper from './NodeWrapper';
import type { StrategyNodeData } from '@/stores/strategyStore';

function ActionNode({ id, data, selected }: NodeProps<StrategyNodeData>) {
  const { label, category, description, params } = data;
  const isBuy = params?.orderType !== undefined; // 买入节点有 orderType

  return (
    <NodeWrapper
      id={id}
      label={label}
      category={category}
      description={description}
      selected={selected}
      outputHandles={['output']}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isBuy ? (
          <>
            <div style={{ fontSize: 11 }}>
              订单: <strong>{params.orderType === 'limit' ? '限价' : '市价'}</strong>
            </div>
            <div style={{ fontSize: 11 }}>
              仓位: <strong>{String(params.amountPct)}%</strong>
              {params.leverage && Number(params.leverage) > 1 && (
                <> · {String(params.leverage)}x 杠杆</>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11 }}>
            平仓: <strong>{String(params.amountPct)}%</strong>
          </div>
        )}
      </div>
    </NodeWrapper>
  );
}

export default memo(ActionNode);
