import { create } from 'zustand';
import type { Node, Edge, Connection } from 'reactflow';
import type { Strategy, StrategyNode, StrategyEdge, VisualStrategy, NodeCategory } from '@/lib/types';
import { strategyApi } from '@/lib/api';

// ============================================================
// Node Data 类型
// ============================================================

export interface StrategyNodeData {
  label: string;
  category: NodeCategory;
  type: string;
  params: Record<string, unknown>;
  description?: string;
}

// ============================================================
// 历史记录
// ============================================================

interface HistoryEntry {
  nodes: Node<StrategyNodeData>[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

// ============================================================
// Store State
// ============================================================

interface StrategyState {
  // 策略元数据
  strategyId: string | null;
  name: string;
  strategyType: 'visual' | 'code';
  status: Strategy['status'];

  // 图数据
  nodes: Node<StrategyNodeData>[];
  edges: Edge[];

  // 选中状态
  selectedNodeId: string | null;

  // 撤销/重做
  past: HistoryEntry[];
  future: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;

  // 状态标记
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  isLoading: boolean;

  // 验证
  validationErrors: Array<{ nodeId?: string; message: string }>;
  validationWarnings: string[];

  // === Actions ===

  /** 初始化策略（新建或加载） */
  initStrategy: (id?: string, type?: 'visual' | 'code') => Promise<void>;

  /** 节点操作 */
  setNodes: (nodes: Node<StrategyNodeData>[]) => void;
  addNode: (node: Node<StrategyNodeData>) => void;
  updateNode: (id: string, data: Partial<StrategyNodeData>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;

  /** 边操作 */
  addEdge: (connection: Connection) => void;
  removeEdge: (id: string) => void;

  /** 撤销/重做 */
  undo: () => void;
  redo: () => void;

  /** 持久化 */
  save: () => Promise<void>;
  setName: (name: string) => void;

  /** 序列化 */
  toVisualStrategy: () => VisualStrategy;

  /** 验证 */
  runValidation: () => void;

  /** 重置 */
  reset: () => void;
}

// ============================================================
// 帮助函数
// ============================================================

/** 推入历史栈 */
function pushHistory(state: StrategyState): Partial<StrategyState> {
  const entry: HistoryEntry = {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  };

  return {
    past: [...state.past.slice(-MAX_HISTORY + 1), entry],
    future: [],
    canUndo: true,
    canRedo: false,
    isDirty: true,
  };
}

/** 验证策略图 */
function validateGraph(
  nodes: Node<StrategyNodeData>[],
  edges: Edge[]
): { errors: StrategyState['validationErrors']; warnings: string[] } {
  const errors: StrategyState['validationErrors'] = [];
  const warnings: string[] = [];

  // 检查空图
  if (nodes.length === 0) {
    errors.push({ message: '策略图为空，请添加至少一个节点' });
    return { errors, warnings };
  }

  // 检查孤立节点
  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });

  nodes.forEach((n) => {
    if (!connectedNodeIds.has(n.id) && nodes.length > 1) {
      warnings.push(`节点 "${n.data?.label || n.id}" 未连接`);
    }
  });

  // 检查是否有操作节点 (action)
  const hasAction = nodes.some((n) => n.data?.category === 'action');
  if (!hasAction) {
    warnings.push('策略未包含交易操作节点（买入/卖出）');
  }

  // 检查是否有风控节点
  const hasRisk = nodes.some((n) => n.data?.category === 'risk');
  if (!hasRisk) {
    warnings.push('策略未配置风控节点（止损/止盈），推荐添加');
  }

  // 检查终止节点（无出边的节点应为 action 或 risk）
  const nodesWithOutgoing = new Set(edges.map((e) => e.source));
  nodes.forEach((n) => {
    if (
      !nodesWithOutgoing.has(n.id) &&
      n.data?.category !== 'action' &&
      n.data?.category !== 'risk' &&
      nodes.length > 1
    ) {
      warnings.push(`节点 "${n.data?.label || n.id}" 没有下游连接`);
    }
  });

  return { errors, warnings };
}

// ============================================================
// 初始状态
// ============================================================

const INITIAL_STATE = {
  strategyId: null,
  name: '未命名策略',
  strategyType: 'visual' as const,
  status: 'draft' as Strategy['status'],
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  isLoading: false,
  validationErrors: [],
  validationWarnings: [],
};

// ============================================================
// Store
// ============================================================

export const useStrategyStore = create<StrategyState>((set, get) => ({
  ...INITIAL_STATE,

  // --- initStrategy ---
  initStrategy: async (id?: string, type: 'visual' | 'code' = 'visual') => {
    if (!id) {
      // 新建
      set({
        ...INITIAL_STATE,
        strategyType: type,
        isDirty: false,
      });
      return;
    }

    // 加载已有策略
    set({ isLoading: true });
    try {
      const res = await strategyApi.getDetail(id);
      const strategy = res.data as Strategy;
      set({
        strategyId: strategy.id,
        name: strategy.name,
        strategyType: strategy.type as 'visual' | 'code',
        status: strategy.status,
        isDirty: false,
        isLoading: false,
      });

      // 如果是可视化策略，加载节点和边
      if (strategy.type === 'visual' && (strategy as VisualStrategy).nodes) {
        const vs = strategy as unknown as VisualStrategy;
        set({
          nodes: (vs.nodes || []) as Node<StrategyNodeData>[],
          edges: (vs.edges || []) as Edge[],
        });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  // --- setNodes ---
  setNodes: (nodes) => {
    const prev = get();
    const updates = pushHistory(prev);
    set({ nodes, ...updates });
    get().runValidation();
  },

  // --- addNode ---
  addNode: (node) => {
    const prev = get();
    const updates = pushHistory(prev);
    set({ nodes: [...prev.nodes, node], ...updates });
    get().runValidation();
  },

  // --- updateNode ---
  updateNode: (id, data) => {
    const prev = get();
    const updates = pushHistory(prev);
    set({
      nodes: prev.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...data } as StrategyNodeData }
          : n
      ),
      ...updates,
    });
  },

  // --- updateNodePosition ---
  updateNodePosition: (id, position) => {
    const prev = get();
    set({
      nodes: prev.nodes.map((n) =>
        n.id === id ? { ...n, position } : n
      ),
    });
  },

  // --- removeNode ---
  removeNode: (id) => {
    const prev = get();
    const updates = pushHistory(prev);
    set({
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: prev.selectedNodeId === id ? null : prev.selectedNodeId,
      ...updates,
    });
    get().runValidation();
  },

  // --- selectNode ---
  selectNode: (id) => {
    set({ selectedNodeId: id });
  },

  // --- addEdge ---
  addEdge: (connection) => {
    const prev = get();
    const updates = pushHistory(prev);
    const newEdge: Edge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };
    set({ edges: [...prev.edges, newEdge], ...updates });
    get().runValidation();
  },

  // --- removeEdge ---
  removeEdge: (id) => {
    const prev = get();
    const updates = pushHistory(prev);
    set({ edges: prev.edges.filter((e) => e.id !== id), ...updates });
    get().runValidation();
  },

  // --- undo ---
  undo: () => {
    const prev = get();
    if (prev.past.length === 0) return;

    const newPast = [...prev.past];
    const lastEntry = newPast.pop()!;

    const currentEntry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(prev.nodes)),
      edges: JSON.parse(JSON.stringify(prev.edges)),
    };

    set({
      nodes: lastEntry.nodes,
      edges: lastEntry.edges,
      past: newPast,
      future: [currentEntry, ...prev.future],
      canUndo: newPast.length > 0,
      canRedo: true,
      isDirty: true,
    });
  },

  // --- redo ---
  redo: () => {
    const prev = get();
    if (prev.future.length === 0) return;

    const newFuture = [...prev.future];
    const nextEntry = newFuture.shift()!;

    const currentEntry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(prev.nodes)),
      edges: JSON.parse(JSON.stringify(prev.edges)),
    };

    set({
      nodes: nextEntry.nodes,
      edges: nextEntry.edges,
      past: [...prev.past, currentEntry],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
      isDirty: true,
    });
  },

  // --- save ---
  save: async () => {
    const state = get();
    if (state.isSaving) return;

    set({ isSaving: true });
    try {
      const payload = {
        name: state.name,
        type: state.strategyType,
        nodes: state.nodes as unknown as StrategyNode[],
        edges: state.edges as unknown as StrategyEdge[],
      };

      if (state.strategyId) {
        await strategyApi.update(state.strategyId, payload as unknown as Partial<Strategy>);
      } else {
        const res = await strategyApi.create(payload as unknown as Strategy);
        set({ strategyId: (res.data as Strategy).id });
      }

      set({
        isSaving: false,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
      });
    } catch {
      set({ isSaving: false });
      throw new Error('保存失败');
    }
  },

  // --- setName ---
  setName: (name) => {
    set({ name, isDirty: true });
  },

  // --- toVisualStrategy ---
  toVisualStrategy: () => {
    const state = get();
    return {
      nodes: state.nodes as unknown as StrategyNode[],
      edges: state.edges as unknown as StrategyEdge[],
    };
  },

  // --- runValidation ---
  runValidation: () => {
    const state = get();
    const result = validateGraph(state.nodes, state.edges);
    set({
      validationErrors: result.errors,
      validationWarnings: result.warnings,
    });
  },

  // --- reset ---
  reset: () => {
    set({ ...INITIAL_STATE });
  },
}));
