import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Space, Tooltip, Tag, Collapse, message, Drawer, Tree } from 'antd';
import {
  SaveOutlined, UndoOutlined, RedoOutlined, ArrowLeftOutlined,
  ExportOutlined, ImportOutlined, HistoryOutlined,
  CloseCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  ReactFlow, Background, Controls, MiniMap, ConnectionMode,
  type Connection, type NodeChange, type EdgeChange,
  MarkerType, Panel, applyNodeChanges, applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NODE_CATEGORIES } from '@/lib/constants';
import type { NodeCategory } from '@/lib/types';
import { useStrategyStore, type StrategyNodeData } from '@/stores/strategyStore';
import { NODE_TEMPLATES, createNodeFromTemplate } from '@/features/strategy/hooks/useNodeTemplates';
import NodeParameterForm from '@/features/strategy/components/NodeParameterForm';
import ValidationPanel from '@/features/strategy/components/ValidationPanel';

// 自定义节点类型映射
import IndicatorNode from '@/features/strategy/nodes/IndicatorNode';
import LogicNode from '@/features/strategy/nodes/LogicNode';
import ActionNode from '@/features/strategy/nodes/ActionNode';
import RiskNode from '@/features/strategy/nodes/RiskNode';
import ComparisonNode from '@/features/strategy/nodes/ComparisonNode';

const NODE_TYPES = {
  ema: IndicatorNode,
  sma: IndicatorNode,
  rsi: IndicatorNode,
  macd: IndicatorNode,
  bollinger: IndicatorNode,
  and: LogicNode,
  or: LogicNode,
  not: LogicNode,
  cross: ComparisonNode,
  compare: ComparisonNode,
  buy: ActionNode,
  sell: ActionNode,
  stop_loss: RiskNode,
  take_profit: RiskNode,
  position_sizer: RiskNode,
};

// 默认起始节点
const INITIAL_NODES = [
  {
    id: 'start',
    type: 'default',
    position: { x: 100, y: 250 },
    data: { label: '开始', category: 'logic' as NodeCategory, type: 'start', params: {} },
  },
];

export default function VisualStrategyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Store
  const strategyName = useStrategyStore((s) => s.name);
  const nodes = useStrategyStore((s) => s.nodes);
  const edges = useStrategyStore((s) => s.edges);
  const isDirty = useStrategyStore((s) => s.isDirty);
  const isSaving = useStrategyStore((s) => s.isSaving);
  const canUndo = useStrategyStore((s) => s.canUndo);
  const canRedo = useStrategyStore((s) => s.canRedo);
  const validationErrors = useStrategyStore((s) => s.validationErrors);
  const validationWarnings = useStrategyStore((s) => s.validationWarnings);
  const selectedNodeId = useStrategyStore((s) => s.selectedNodeId);

  const setName = useStrategyStore((s) => s.setName);
  const setNodes = useStrategyStore((s) => s.setNodes);
  const addNode = useStrategyStore((s) => s.addNode);
  const selectNode = useStrategyStore((s) => s.selectNode);
  const addEdge = useStrategyStore((s) => s.addEdge);
  const removeEdge = useStrategyStore((s) => s.removeEdge);
  const undo = useStrategyStore((s) => s.undo);
  const redo = useStrategyStore((s) => s.redo);
  const save = useStrategyStore((s) => s.save);
  const initStrategy = useStrategyStore((s) => s.initStrategy);
  const reset = useStrategyStore((s) => s.reset);

  // UI state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  // 初始化策略
  useEffect(() => {
    initStrategy(id, 'visual');
    return () => { reset(); };
  }, [id]);

  // 节点变化
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodes) as typeof nodes);
  }, [nodes, setNodes]);

  // 边变化
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const updated = applyEdgeChanges(changes, edges);
    // 处理删除
    changes.forEach((c) => {
      if (c.type === 'remove') {
        removeEdge(c.id);
      }
    });
  }, [edges, removeEdge]);

  // 连接
  const onConnect = useCallback((connection: Connection) => {
    addEdge(connection);
  }, [addEdge]);

  // 拖拽释放
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow-type');
    if (!nodeType) return;

    const template = NODE_TEMPLATES.find((t) => t.key === nodeType);
    if (!template) return;

    const position = { x: e.clientX - 300, y: e.clientY - 150 };
    const newNode = createNodeFromTemplate(template, `node-${Date.now()}`, position);
    addNode(newNode as never);
  }, [addNode]);

  // 节点点击
  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // 保存
  const handleSave = async () => {
    try {
      await save();
      message.success('策略已保存');
    } catch {
      message.error('保存失败，请重试');
    }
  };

  // 导出
  const handleExport = () => {
    const state = useStrategyStore.getState();
    const data = JSON.stringify({ nodes: state.nodes, edges: state.edges, name: state.name }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.name || 'strategy'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('策略已导出');
  };

  // 导入
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.nodes) {
            useStrategyStore.setState({ nodes: data.nodes, edges: data.edges || [] });
            setName(data.name || '导入的策略');
            message.success('策略已导入');
          }
        } catch {
          message.error('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const selectedNodeObj = nodes.find((n) => n.id === selectedNodeId);
  const hasIssues = validationErrors.length > 0 || validationWarnings.length > 0;

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        className="card-glass"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(22, 27, 34, 0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '8px 8px 0 0',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/strategy')} type="text" />
          <Input
            value={strategyName}
            onChange={(e) => setName(e.target.value)}
            style={{ width: 200, border: 'none', fontWeight: 600, fontSize: 15, background: 'transparent' }}
          />
          {isDirty && <Tag color="warning">未保存</Tag>}
          {isEditing && <Tag color="blue">编辑模式</Tag>}
        </Space>
        <Space>
          <Tooltip title="撤销 (Ctrl+Z)"><Button icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} /></Tooltip>
          <Tooltip title="重做 (Ctrl+Y)"><Button icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} /></Tooltip>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          <Button icon={<ImportOutlined />} onClick={handleImport}>导入</Button>
          <Button icon={<HistoryOutlined />} onClick={() => setShowOutline(true)}>大纲</Button>
          <Button
            type="primary"
            icon={isSaving ? undefined : <SaveOutlined />}
            loading={isSaving}
            onClick={handleSave}
            disabled={!isDirty}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </Space>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Node Library */}
        {!leftPanelCollapsed && (
          <div style={{
            width: 220,
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            overflow: 'auto',
            padding: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: 8 }}>
              <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>节点库</Typography.Text>
              <Button size="small" type="text" onClick={() => setLeftPanelCollapsed(true)}>✕</Button>
            </div>
            <Collapse
              size="small"
              defaultActiveKey={['indicator', 'action']}
              ghost
              items={NODE_CATEGORIES.map((cat) => ({
                key: cat.key,
                label: <span style={{ fontSize: 12 }}>{cat.icon} {cat.label}</span>,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {NODE_TEMPLATES.filter((n) => n.category === cat.key).map((nodeType) => (
                      <div
                        key={nodeType.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow-type', nodeType.key);
                          e.dataTransfer.setData('application/reactflow-label', nodeType.label);
                          e.dataTransfer.setData('application/reactflow-category', nodeType.category);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 6,
                          cursor: 'grab',
                          fontSize: 12,
                          border: '1px solid var(--border-color)',
                          transition: 'all 150ms',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nodeType.label}</span>
                        <br />
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{nodeType.description}</span>
                      </div>
                    ))}
                  </div>
                ),
              }))}
            />
          </div>
        )}

        {/* Center: Canvas */}
        <div style={{ flex: 1 }} onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES}
            connectionMode={ConnectionMode.Loose}
            fitView
            style={{ background: '#0D1117' }}
            defaultEdgeOptions={{
              style: { stroke: '#8B949E', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#8B949E' },
            }}
          >
            <Background color="#21262D" gap={20} />
            <Controls
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
              nodeColor="#F0B90B"
            />
            {leftPanelCollapsed && (
              <Panel position="top-left">
                <Button size="small" onClick={() => setLeftPanelCollapsed(false)}>☰ 节点库</Button>
              </Panel>
            )}
            {rightPanelCollapsed && (
              <Panel position="top-right">
                <Button size="small" onClick={() => setRightPanelCollapsed(false)}>⚙ 配置</Button>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right: Config Panel */}
        {!rightPanelCollapsed && (
          <div style={{
            width: 260,
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-color)',
            overflow: 'auto',
            padding: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>节点配置</Typography.Text>
              <Button size="small" type="text" onClick={() => setRightPanelCollapsed(true)}>✕</Button>
            </div>

            {selectedNodeObj ? (
              <NodeParameterForm />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', paddingTop: 40, fontSize: 13 }}>
                点击画布中的节点<br />查看和编辑参数
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom: Validation */}
      {hasIssues && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          padding: '8px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            验证结果
          </div>
          {validationErrors.map((e, i) => (
            <div key={`err-${i}`} style={{ color: 'var(--red-trade)', fontSize: 11, cursor: e.nodeId ? 'pointer' : 'default' }}
              onClick={() => e.nodeId && selectNode(e.nodeId)}>
              <CloseCircleOutlined /> {e.message}
            </div>
          ))}
          {validationWarnings.map((w, i) => (
            <div key={`warn-${i}`} style={{ color: 'var(--warning)', fontSize: 11 }}>
              <WarningOutlined /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Outline Drawer */}
      <Drawer title="策略大纲" open={showOutline} onClose={() => setShowOutline(false)} width={300}>
        <Tree
          treeData={[
            {
              title: '📊 技术指标', key: 'ind',
              children: nodes.filter((n) => n.data?.category === 'indicator').map((n) => ({
                title: n.data?.label || n.id, key: n.id,
              })),
            },
            {
              title: '🔀 比较逻辑', key: 'cmp',
              children: nodes.filter((n) => n.data?.category === 'comparison').map((n) => ({
                title: n.data?.label || n.id, key: n.id,
              })),
            },
            {
              title: '🔗 逻辑组合', key: 'log',
              children: nodes.filter((n) => n.data?.category === 'logic').map((n) => ({
                title: n.data?.label || n.id, key: n.id,
              })),
            },
            {
              title: '🎯 下单动作', key: 'act',
              children: nodes.filter((n) => n.data?.category === 'action').map((n) => ({
                title: n.data?.label || n.id, key: n.id,
              })),
            },
            {
              title: '🛡️ 风控动作', key: 'risk',
              children: nodes.filter((n) => n.data?.category === 'risk').map((n) => ({
                title: n.data?.label || n.id, key: n.id,
              })),
            },
          ]}
          defaultExpandAll
        />
      </Drawer>
    </div>
  );
}
