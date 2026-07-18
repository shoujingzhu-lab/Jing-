import type { NodeCategory } from '@/lib/types';
import type { StrategyNodeData } from '@/stores/strategyStore';

/**
 * 节点模板定义
 *
 * 定义了可视化策略编辑器中可用的所有节点类型及其参数 schema。
 */

export interface NodeTemplate {
  key: string;
  label: string;
  category: NodeCategory;
  description: string;
  defaultParams: Record<string, unknown>;
  /** 参数 schema：每个参数的 label 和控件类型 */
  paramSchema?: Record<string, {
    label: string;
    type: 'number' | 'string' | 'boolean' | 'select';
    defaultValue: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: Array<{ label: string; value: unknown }>;
  }>;
  /** 可连接的目标节点类别 */
  allowedTargets?: NodeCategory[];
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  // ===== 指标节点 =====
  {
    key: 'ema',
    label: 'EMA 均线',
    category: 'indicator',
    description: '指数移动平均线',
    defaultParams: { period: 20, source: 'close' },
    paramSchema: {
      period: { label: '周期', type: 'number', defaultValue: 20, min: 1, max: 500 },
      source: { label: '数据源', type: 'select', defaultValue: 'close', options: [
        { label: '收盘价', value: 'close' }, { label: '开盘价', value: 'open' },
        { label: '最高价', value: 'high' }, { label: '最低价', value: 'low' },
      ]},
    },
  },
  {
    key: 'sma',
    label: 'SMA 均线',
    category: 'indicator',
    description: '简单移动平均线',
    defaultParams: { period: 50, source: 'close' },
    paramSchema: {
      period: { label: '周期', type: 'number', defaultValue: 50, min: 1, max: 500 },
      source: { label: '数据源', type: 'select', defaultValue: 'close', options: [
        { label: '收盘价', value: 'close' }, { label: '开盘价', value: 'open' },
      ]},
    },
  },
  {
    key: 'rsi',
    label: 'RSI 指标',
    category: 'indicator',
    description: '相对强弱指数',
    defaultParams: { period: 14, oversold: 30, overbought: 70 },
    paramSchema: {
      period: { label: '周期', type: 'number', defaultValue: 14, min: 2, max: 100 },
      oversold: { label: '超卖阈值', type: 'number', defaultValue: 30, min: 0, max: 50 },
      overbought: { label: '超买阈值', type: 'number', defaultValue: 70, min: 50, max: 100 },
    },
  },
  {
    key: 'macd',
    label: 'MACD',
    category: 'indicator',
    description: '异同移动平均线',
    defaultParams: { fast: 12, slow: 26, signal: 9 },
    paramSchema: {
      fast: { label: '快线', type: 'number', defaultValue: 12, min: 2, max: 100 },
      slow: { label: '慢线', type: 'number', defaultValue: 26, min: 2, max: 200 },
      signal: { label: '信号线', type: 'number', defaultValue: 9, min: 2, max: 50 },
    },
  },
  {
    key: 'bollinger',
    label: '布林带',
    category: 'indicator',
    description: 'Bollinger Bands',
    defaultParams: { period: 20, stdDev: 2 },
    paramSchema: {
      period: { label: '周期', type: 'number', defaultValue: 20, min: 2, max: 200 },
      stdDev: { label: '标准差', type: 'number', defaultValue: 2, min: 1, max: 5, step: 0.5 },
    },
  },

  // ===== 比较节点 =====
  {
    key: 'cross',
    label: '均线交叉',
    category: 'comparison',
    description: '快慢线交叉判断',
    defaultParams: { fastLine: 'ema_fast', slowLine: 'ema_slow' },
    allowedTargets: ['logic', 'action'],
  },
  {
    key: 'compare',
    label: '数值比较',
    category: 'comparison',
    description: '大于 / 小于 / 等于比较',
    defaultParams: { operator: 'gt', threshold: 0 },
    paramSchema: {
      operator: { label: '运算符', type: 'select', defaultValue: 'gt', options: [
        { label: '大于 >', value: 'gt' }, { label: '小于 <', value: 'lt' },
        { label: '等于 =', value: 'eq' }, { label: '大于等于 ≥', value: 'gte' },
        { label: '小于等于 ≤', value: 'lte' },
      ]},
      threshold: { label: '阈值', type: 'number', defaultValue: 0 },
    },
    allowedTargets: ['logic', 'action'],
  },

  // ===== 逻辑节点 =====
  {
    key: 'and',
    label: 'AND 逻辑与',
    category: 'logic',
    description: '所有条件同时满足',
    defaultParams: {},
    allowedTargets: ['action', 'logic'],
  },
  {
    key: 'or',
    label: 'OR 逻辑或',
    category: 'logic',
    description: '任意条件满足',
    defaultParams: {},
    allowedTargets: ['action', 'logic'],
  },
  {
    key: 'not',
    label: 'NOT 逻辑非',
    category: 'logic',
    description: '条件取反',
    defaultParams: {},
    allowedTargets: ['action', 'logic'],
  },

  // ===== 操作节点 =====
  {
    key: 'buy',
    label: '买入开仓',
    category: 'action',
    description: '市价/限价买入',
    defaultParams: { orderType: 'market', amountPct: 100, leverage: 1 },
    paramSchema: {
      orderType: { label: '订单类型', type: 'select', defaultValue: 'market', options: [
        { label: '市价', value: 'market' }, { label: '限价', value: 'limit' },
      ]},
      amountPct: { label: '仓位比例(%)', type: 'number', defaultValue: 100, min: 1, max: 100 },
      leverage: { label: '杠杆倍数', type: 'number', defaultValue: 1, min: 1, max: 125 },
    },
    allowedTargets: ['risk'],
  },
  {
    key: 'sell',
    label: '卖出平仓',
    category: 'action',
    description: '全部/部分平仓',
    defaultParams: { amountPct: 100 },
    paramSchema: {
      amountPct: { label: '平仓比例(%)', type: 'number', defaultValue: 100, min: 1, max: 100 },
    },
  },

  // ===== 风控节点 =====
  {
    key: 'stop_loss',
    label: '止损',
    category: 'risk',
    description: '固定百分比止损',
    defaultParams: { pct: 5, type: 'fixed' },
    paramSchema: {
      pct: { label: '止损比例(%)', type: 'number', defaultValue: 5, min: 0.1, max: 50, step: 0.1 },
      type: { label: '止损类型', type: 'select', defaultValue: 'fixed', options: [
        { label: '固定百分比', value: 'fixed' }, { label: '追踪止损', value: 'trailing' },
      ]},
    },
  },
  {
    key: 'take_profit',
    label: '止盈',
    category: 'risk',
    description: '固定百分比止盈',
    defaultParams: { pct: 10, type: 'fixed' },
    paramSchema: {
      pct: { label: '止盈比例(%)', type: 'number', defaultValue: 10, min: 0.1, max: 200, step: 0.1 },
      type: { label: '止盈类型', type: 'select', defaultValue: 'fixed', options: [
        { label: '固定百分比', value: 'fixed' }, { label: '移动止盈', value: 'trailing' },
      ]},
    },
  },
  {
    key: 'position_sizer',
    label: '仓位管理',
    category: 'risk',
    description: '风险度仓位计算',
    defaultParams: { riskPct: 1, maxPosition: 10000 },
    paramSchema: {
      riskPct: { label: '风险比例(%)', type: 'number', defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
      maxPosition: { label: '最大仓位(USDT)', type: 'number', defaultValue: 10000, min: 0 },
    },
  },
];

/**
 * 按类别分组的节点模板
 */
export function getTemplatesByCategory(): Record<NodeCategory, NodeTemplate[]> {
  const grouped: Record<string, NodeTemplate[]> = {};
  NODE_TEMPLATES.forEach((t) => {
    if (!grouped[t.category]) grouped[t.category] = [];
    grouped[t.category].push(t);
  });
  return grouped as Record<NodeCategory, NodeTemplate[]>;
}

/**
 * 根据 key 查找模板
 */
export function getTemplateByKey(key: string): NodeTemplate | undefined {
  return NODE_TEMPLATES.find((t) => t.key === key);
}

/**
 * 从模板创建 ReactFlow Node
 */
export function createNodeFromTemplate(
  template: NodeTemplate,
  id: string,
  position: { x: number; y: number }
): { id: string; type: string; position: { x: number; y: number }; data: StrategyNodeData } {
  return {
    id,
    type: template.key,
    position,
    data: {
      label: template.label,
      category: template.category,
      type: template.key,
      params: { ...template.defaultParams },
      description: template.description,
    },
  };
}
