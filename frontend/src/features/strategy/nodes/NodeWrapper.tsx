import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeCategory } from '@/lib/types';

interface NodeWrapperProps {
  id: string;
  label: string;
  category: NodeCategory;
  description?: string;
  selected?: boolean;
  /** 节点内容 (内部渲染) */
  children: React.ReactNode;
  /** 输入句柄 */
  inputHandles?: string[];
  /** 输出句柄 */
  outputHandles?: string[];
}

/** 类别配色 */
const CATEGORY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  indicator:   { border: '#42A5F5', bg: 'rgba(66, 165, 245, 0.12)', text: '#42A5F5' },
  comparison:  { border: '#AB47BC', bg: 'rgba(171, 71, 188, 0.12)', text: '#AB47BC' },
  logic:       { border: '#7E57C2', bg: 'rgba(126, 87, 194, 0.12)', text: '#7E57C2' },
  action:      { border: '#26A69A', bg: 'rgba(38, 166, 154, 0.12)', text: '#26A69A' },
  risk:        { border: '#FF9800', bg: 'rgba(255, 152, 0, 0.12)', text: '#FF9800' },
  volume:      { border: '#78909C', bg: 'rgba(120, 144, 156, 0.12)', text: '#78909C' },
  price_pattern: { border: '#EC407A', bg: 'rgba(236, 64, 122, 0.12)', text: '#EC407A' },
  orderbook:   { border: '#29B6F6', bg: 'rgba(41, 182, 246, 0.12)', text: '#29B6F6' },
  derivatives: { border: '#FF7043', bg: 'rgba(255, 112, 67, 0.12)', text: '#FF7043' },
  math:        { border: '#9CCC65', bg: 'rgba(156, 204, 101, 0.12)', text: '#9CCC65' },
};

const CATEGORY_LABELS: Record<string, string> = {
  indicator: '指标',
  comparison: '比较',
  logic: '逻辑',
  action: '交易',
  risk: '风控',
  volume: '成交量',
  price_pattern: '形态',
  orderbook: '订单簿',
  derivatives: '衍生品',
  math: '数学',
};

/**
 * NodeWrapper — 自定义节点外壳
 *
 * 提供统一的节点外观（标题栏、类别标签、输入/输出句柄）。
 */
function NodeWrapper({
  id,
  label,
  category,
  description,
  selected,
  children,
  inputHandles,
  outputHandles,
}: NodeWrapperProps) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.indicator;
  const catLabel = CATEGORY_LABELS[category] || category;
  const handles = inputHandles || ['input'];
  const outHandles = outputHandles || ['output'];

  return (
    <div
      style={{
        minWidth: 180,
        background: 'var(--bg-secondary)',
        border: `2px solid ${selected ? 'var(--brand)' : colors.border}`,
        borderRadius: 8,
        boxShadow: selected ? 'var(--shadow-glow-brand)' : 'var(--shadow-card)',
        transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)';
        }
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: colors.bg,
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 12,
          fontWeight: 600,
          color: colors.text,
        }}
      >
        <span>{label}</span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 3,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {catLabel}
        </span>
      </div>

      {/* 内容区域 */}
      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)' }}>
        {children}
        {description && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 4, lineHeight: 1.3 }}>
            {description}
          </div>
        )}
      </div>

      {/* 输入句柄 */}
      {handles.map((h, i) => (
        <Handle
          key={`in-${h}`}
          id={h}
          type="target"
          position={Position.Left}
          style={{
            top: `${((i + 1) / (handles.length + 1)) * 100}%`,
            width: 10,
            height: 10,
            background: colors.border,
            border: `2px solid var(--bg-secondary)`,
          }}
        />
      ))}

      {/* 输出句柄 */}
      {outHandles.map((h, i) => (
        <Handle
          key={`out-${h}`}
          id={h}
          type="source"
          position={Position.Right}
          style={{
            top: `${((i + 1) / (outHandles.length + 1)) * 100}%`,
            width: 10,
            height: 10,
            background: colors.border,
            border: `2px solid var(--bg-secondary)`,
          }}
        />
      ))}
    </div>
  );
}

export default memo(NodeWrapper);
