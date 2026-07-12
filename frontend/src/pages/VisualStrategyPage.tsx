import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Space, Tooltip, Tag, Collapse, Badge, message, Drawer, Tree } from 'antd';
import {
  SaveOutlined, UndoOutlined, RedoOutlined, ArrowLeftOutlined,
  ExportOutlined, ImportOutlined, PlayCircleOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, HistoryOutlined, BugOutlined,
} from '@ant-design/icons';
import {
  ReactFlow, Background, Controls, MiniMap, ConnectionMode,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  MarkerType, Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NODE_CATEGORIES } from '@/lib/constants';
import type { NodeCategory } from '@/lib/types';

// 策略节点类型
interface StrategyNodeData {
  label: string;
  category: NodeCategory;
  params?: Record<string, unknown>;
}

const INITIAL_NODES: Node<StrategyNodeData>[] = [
  { id: 'start', type: 'default', position: { x: 100, y: 250 }, data: { label: '开始', category: 'logic' } },
];

const NODE_PALETTE = [
  { type: 'ema', label: 'EMA', category: 'indicator' as NodeCategory, description: '指数移动平均线', defaultParams: { period: 20 } },
  { type: 'ma', label: 'MA', category: 'indicator' as NodeCategory, description: '简单移动平均线', defaultParams: { period: 20 } },
  { type: 'boll', label: '布林带', category: 'indicator' as NodeCategory, description: 'Bollinger Bands', defaultParams: { period: 20, stdDev: 2 } },
  { type: 'rsi', label: 'RSI', category: 'indicator' as NodeCategory, description: '相对强弱指数', defaultParams: { period: 14 } },
  { type: 'macd', label: 'MACD', category: 'indicator' as NodeCategory, description: '移动平均收敛散度', defaultParams: { fast: 12, slow: 26, signal: 9 } },
  { type: 'volume', label: '成交量', category: 'volume' as NodeCategory, description: '成交量指标', defaultParams: { threshold: 1.5 } },
  { type: 'cross', label: '交叉', category: 'comparison' as NodeCategory, description: '两线交叉判断', defaultParams: {} },
  { type: 'compare', label: '比较', category: 'comparison' as NodeCategory, description: '大于/小于比较', defaultParams: { operator: '>' } },
  { type: 'and', label: 'AND', category: 'logic' as NodeCategory, description: '逻辑与', defaultParams: {} },
  { type: 'or', label: 'OR', category: 'logic' as NodeCategory, description: '逻辑或', defaultParams: {} },
  { type: 'not', label: 'NOT', category: 'logic' as NodeCategory, description: '逻辑非', defaultParams: {} },
  { type: 'buy', label: '买入', category: 'action' as NodeCategory, description: '开多/买入', defaultParams: { orderType: 'market', amount: 0.1 } },
  { type: 'sell', label: '卖出', category: 'action' as NodeCategory, description: '平多/卖出', defaultParams: { orderType: 'market', amount: 0.1 } },
  { type: 'stopLoss', label: '止损', category: 'risk' as NodeCategory, description: '止损点设置', defaultParams: { percent: 5 } },
  { type: 'takeProfit', label: '止盈', category: 'risk' as NodeCategory, description: '止盈点设置', defaultParams: { percent: 10 } },
  { type: 'trailStop', label: '移动止损', category: 'risk' as NodeCategory, description: '追踪止损', defaultParams: { percent: 3 } },
];

export default function VisualStrategyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [strategyName, setStrategyName] = useState(isEditing ? '我的策略' : '未命名策略');
  const [nodes, setNodes] = useState<Node<StrategyNodeData>[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<StrategyNodeData> | null>(null);
  const [saving, setSaving] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [validationErrors] = useState<string[]>([]);
  const [validationWarnings] = useState(['策略未配置止损节点']);
  const [unsaved, setUnsaved] = useState(false);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const updated = [...nds];
      changes.forEach((c) => {
        if (c.type === 'position' && c.position) {
          const idx = updated.findIndex((n) => n.id === c.id);
          if (idx >= 0) updated[idx] = { ...updated[idx], position: c.position };
        }
        if (c.type === 'remove') {
          const idx = updated.findIndex((n) => n.id === c.id);
          if (idx >= 0) updated.splice(idx, 1);
        }
      });
      return updated;
    });
    setUnsaved(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const updated = [...eds];
      changes.forEach((c) => {
        if (c.type === 'remove') {
          const idx = updated.findIndex((e) => e.id === c.id);
          if (idx >= 0) updated.splice(idx, 1);
        }
      });
      return updated;
    });
    setUnsaved(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => [...eds, {
      id: `e-${connection.source}-${connection.target}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#8B949E' },
      style: { stroke: '#8B949E', strokeWidth: 2 },
    }]);
    setUnsaved(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow-type');
    const label = e.dataTransfer.getData('application/reactflow-label');
    const category = e.dataTransfer.getData('application/reactflow-category') as NodeCategory;
    if (!type) return;

    const position = { x: e.clientX - 300, y: e.clientY - 150 };
    const newNode: Node<StrategyNodeData> = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: { label, category, params: {} },
    };
    setNodes((nds) => [...nds, newNode]);
    setUnsaved(true);
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setUnsaved(false);
      message.success('策略已保存');
    }, 800);
  };

  const selectedPalette = NODE_PALETTE.find((n) => n.type === (selectedNode?.data?.label?.toLowerCase()));

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', borderRadius: '8px 8px 0 0' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/strategy')} type="text" />
          <Input value={strategyName} onChange={(e) => { setStrategyName(e.target.value); setUnsaved(true); }}
            style={{ width: 200, border: 'none', fontWeight: 600, fontSize: 15, background: 'transparent' }} />
          {unsaved && <Tag color="warning">未保存</Tag>}
        </Space>
        <Space>
          <Tooltip title="撤销"><Button icon={<UndoOutlined />} disabled /></Tooltip>
          <Tooltip title="重做"><Button icon={<RedoOutlined />} disabled /></Tooltip>
          <Button icon={<ExportOutlined />}>导出代码</Button>
          <Button icon={<ImportOutlined />}>导入</Button>
          <Button icon={<HistoryOutlined />} onClick={() => setShowOutline(true)}>大纲</Button>
          <Button type="primary" icon={saving ? undefined : <SaveOutlined />} loading={saving} onClick={handleSave} disabled={!unsaved}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </Space>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Node Library */}
        {!leftPanelCollapsed && (
          <div style={{ width: 220, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', overflow: 'auto', padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: 8 }}>
              <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>节点库</Typography.Text>
              <Button size="small" type="text" onClick={() => setLeftPanelCollapsed(true)}>✕</Button>
            </div>
            <Collapse size="small" defaultActiveKey={['indicator', 'action']} ghost items={
              NODE_CATEGORIES.map((cat) => ({
                key: cat.key,
                label: <span style={{ fontSize: 12 }}>{cat.icon} {cat.label}</span>,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {NODE_PALETTE.filter((n) => n.category === cat.key).map((nodeType) => (
                      <div key={nodeType.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow-type', nodeType.type);
                          e.dataTransfer.setData('application/reactflow-label', nodeType.label);
                          e.dataTransfer.setData('application/reactflow-category', nodeType.category);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        style={{ padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 6, cursor: 'grab', fontSize: 12, border: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nodeType.label}</span>
                        <br />
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{nodeType.description}</span>
                      </div>
                    ))}
                  </div>
                ),
              }))
            } />
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
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            connectionMode={ConnectionMode.Loose}
            fitView
            style={{ background: '#0D1117' }}
            defaultEdgeOptions={{
              style: { stroke: '#8B949E', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#8B949E' },
            }}
          >
            <Background color="#21262D" gap={20} />
            <Controls style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
            <MiniMap style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} nodeColor="#F0B90B" />
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
          <div style={{ width: 250, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', overflow: 'auto', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Typography.Text strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>节点配置</Typography.Text>
              <Button size="small" type="text" onClick={() => setRightPanelCollapsed(true)}>✕</Button>
            </div>
            {selectedNode ? (
              <div>
                <Typography.Text style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {selectedNode.data.label}
                </Typography.Text>
                <Tag>{selectedNode.id}</Tag>
                {selectedPalette?.defaultParams && Object.keys(selectedPalette.defaultParams).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>参数</Typography.Text>
                    {Object.entries(selectedPalette.defaultParams).map(([key, val]) => (
                      <div key={key} style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block' }}>{key}</label>
                        <Input size="small" defaultValue={String(val)} style={{ fontFamily: "'JetBrains Mono', monospace" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', paddingTop: 40, fontSize: 13 }}>
                点击画布中的节点<br />查看和编辑参数
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom: Validation */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', padding: '6px 16px', fontSize: 12 }}>
          {validationErrors.map((e, i) => (
            <div key={`e${i}`} style={{ color: 'var(--red-trade)' }}><CloseCircleOutlined /> {e}</div>
          ))}
          {validationWarnings.map((w, i) => (
            <div key={`w${i}`} style={{ color: 'var(--warning)' }}><WarningOutlined /> {w}</div>
          ))}
        </div>
      )}

      {/* Outline Drawer */}
      <Drawer title="策略大纲" open={showOutline} onClose={() => setShowOutline(false)} width={300}>
        <Tree treeData={[
          { title: '📊 技术指标', key: 'ind', children: nodes.filter((n) => n.data.category === 'indicator').map((n) => ({ title: n.data.label, key: n.id })) },
          { title: '🔀 比较逻辑', key: 'cmp', children: nodes.filter((n) => n.data.category === 'comparison').map((n) => ({ title: n.data.label, key: n.id })) },
          { title: '🔗 逻辑组合', key: 'log', children: nodes.filter((n) => n.data.category === 'logic').map((n) => ({ title: n.data.label, key: n.id })) },
          { title: '🎯 下单动作', key: 'act', children: nodes.filter((n) => n.data.category === 'action').map((n) => ({ title: n.data.label, key: n.id })) },
          { title: '🛡️ 风控动作', key: 'risk', children: nodes.filter((n) => n.data.category === 'risk').map((n) => ({ title: n.data.label, key: n.id })) },
        ]} defaultExpandAll />
      </Drawer>
    </div>
  );
}
