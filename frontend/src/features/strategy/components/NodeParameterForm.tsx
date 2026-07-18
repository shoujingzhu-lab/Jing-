import { Input, InputNumber, Select, Switch, Typography } from 'antd';
import { getTemplateByKey } from '../hooks/useNodeTemplates';
import { useStrategyStore } from '@/stores/strategyStore';

/**
 * NodeParameterForm — 节点参数编辑表单
 *
 * 依据节点模板的 paramSchema 动态生成表单控件。
 * 修改通过 strategyStore.updateNode 持久化到节点 data.params。
 */
export default function NodeParameterForm() {
  const selectedNodeId = useStrategyStore((s) => s.selectedNodeId);
  const nodes = useStrategyStore((s) => s.nodes);
  const updateNode = useStrategyStore((s) => s.updateNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode || !selectedNode.data) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
        点击画布中的节点查看和编辑参数
      </div>
    );
  }

  const template = getTemplateByKey(selectedNode.data.type);
  const paramSchema = template?.paramSchema;
  const params = selectedNode.data.params || {};

  if (!paramSchema || Object.keys(paramSchema).length === 0) {
    return (
      <div>
        <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 12 }}>
          {selectedNode.data.label}
        </Typography.Title>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {selectedNode.data.description || '该节点无可配置参数'}
        </div>
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    updateNode(selectedNode.id, {
      params: { ...params, [key]: value },
    });
  };

  return (
    <div>
      {/* 节点信息头 */}
      <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
        {selectedNode.data.label}
      </Typography.Title>
      <Typography.Paragraph style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>
        {selectedNode.data.description || `类型: ${selectedNode.data.type}`}
      </Typography.Paragraph>

      {/* 参数字段 */}
      {Object.entries(paramSchema).map(([key, schema]) => {
        const currentValue = params[key] ?? schema.defaultValue;

        switch (schema.type) {
          case 'number':
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {schema.label}
                </label>
                <InputNumber
                  value={currentValue as number}
                  min={schema.min}
                  max={schema.max}
                  step={schema.step}
                  onChange={(v) => handleChange(key, v)}
                  style={{ width: '100%' }}
                  size="small"
                />
              </div>
            );

          case 'select':
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {schema.label}
                </label>
                <Select
                  value={currentValue}
                  options={schema.options}
                  onChange={(v) => handleChange(key, v)}
                  style={{ width: '100%' }}
                  size="small"
                />
              </div>
            );

          case 'boolean':
            return (
              <div key={key} style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {schema.label}
                </label>
                <Switch
                  checked={currentValue as boolean}
                  onChange={(v) => handleChange(key, v)}
                  size="small"
                />
              </div>
            );

          case 'string':
          default:
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {schema.label}
                </label>
                <Input
                  value={currentValue as string}
                  onChange={(e) => handleChange(key, e.target.value)}
                  size="small"
                />
              </div>
            );
        }
      })}
    </div>
  );
}
