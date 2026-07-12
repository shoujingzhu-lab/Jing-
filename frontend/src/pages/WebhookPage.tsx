import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, InputNumber, message, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import EmptyState from '@/components/ui/EmptyState';
import StatusTag from '@/components/ui/StatusTag';
import type { Webhook } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const MOCK_WEBHOOKS: Webhook[] = [
  { id: 'wh-001', name: '价格突破告警', url: 'https://hooks.example.com/price-break', secret: 'sec_****', symbols: ['BTC/USDT', 'ETH/USDT'], eventTypes: ['price_breakout'], rateLimit: 10, enabled: true, lastTriggeredAt: '2026-06-07T09:15:00Z' },
  { id: 'wh-002', name: '大额成交通知', url: 'https://hooks.example.com/large-trade', symbols: ['BTC/USDT'], eventTypes: ['large_trade', 'strategy_signal'], rateLimit: 5, enabled: true },
  { id: 'wh-003', name: '风控事件推送', url: 'https://api.example.com/risk-events', secret: 'sec_****', symbols: [], eventTypes: ['risk_event', 'funding_rate_settle'], rateLimit: 20, enabled: false },
];

const EVENT_OPTIONS = [
  { value: 'price_breakout', label: '价格突破' }, { value: 'large_trade', label: '大额成交' },
  { value: 'funding_rate_settle', label: '资金费率结算' }, { value: 'strategy_signal', label: '策略信号' },
  { value: 'risk_event', label: '风控事件' },
];

export default function WebhookPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>(MOCK_WEBHOOKS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [form] = Form.useForm();

  const handleSave = () => {
    form.validateFields().then((vals) => {
      if (editing) {
        setWebhooks((prev) => prev.map((w) => w.id === editing.id ? { ...w, ...vals } : w));
        message.success('Webhook 已更新');
      } else {
        const newWh: Webhook = { id: `wh-${Date.now()}`, ...vals, enabled: true };
        setWebhooks((prev) => [...prev, newWh]);
        message.success('Webhook 已创建');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({ title: '确认删除此 Webhook？', okText: '删除', okButtonProps: { danger: true }, onOk: () => { setWebhooks((prev) => prev.filter((w) => w.id !== id)); message.success('已删除'); } });
  };

  const openEdit = (wh: Webhook) => { setEditing(wh); form.setFieldsValue(wh); setModalOpen(true); };

  const cols: ColumnsType<Webhook> = [
    { title: '名称', dataIndex: 'name', render: (v: string) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span> },
    { title: 'URL', dataIndex: 'url', width: 260, render: (v: string) => <Tooltip title={v}><span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{v.length > 35 ? v.slice(0, 35) + '...' : v}</span></Tooltip> },
    { title: '交易对', dataIndex: 'symbols', width: 160, render: (v: string[]) => v.length === 0 ? <Tag>全部</Tag> : v.map((s) => <Tag key={s}>{s}</Tag>) },
    { title: '事件类型', dataIndex: 'eventTypes', width: 180, render: (v: string[]) => v.map((t) => <Tag key={t} color="blue">{t.replace('_', ' ')}</Tag>) },
    { title: '限速', dataIndex: 'rateLimit', width: 70, render: (v: number) => `${v}/min` },
    { title: '状态', dataIndex: 'enabled', width: 70, render: (v: boolean, r: Webhook) => <Switch checked={v} size="small" onChange={(chk) => setWebhooks((prev) => prev.map((w) => w.id === r.id ? { ...w, enabled: chk } : w))} /> },
    { title: '上次触发', dataIndex: 'lastTriggeredAt', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : <span style={{ color: 'var(--text-secondary)' }}>从未</span> },
    {
      title: '操作', width: 120, render: (_: unknown, r: Webhook) => (
        <Space size="small">
          <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => message.success('测试Webhook已发送')}>测试</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>Webhook 管理</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建 Webhook</Button>
        </Space>
      </div>

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {webhooks.length === 0 ? (
          <EmptyState title="暂无 Webhook" description="创建 Webhook 接收实时事件推送" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建 Webhook</Button>} />
        ) : (
          <Table columns={cols} dataSource={webhooks} rowKey="id" pagination={false} size="middle" scroll={{ x: 1200 }} />
        )}
      </Card>

      <Modal title={editing ? '编辑 Webhook' : '新建 Webhook'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} width={600} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ rateLimit: 10, enabled: true, symbols: [], eventTypes: [] }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="例如: 价格突破告警" /></Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: '请输入 URL' }, { type: 'url', message: '请输入有效 URL' }]}><Input placeholder="https://hooks.example.com/..." /></Form.Item>
          <Form.Item name="secret" label="密钥 (Secret)"><Input.Password placeholder="可选" /></Form.Item>
          <Form.Item name="symbols" label="交易对（空=全部）"><Select mode="tags" placeholder="选择或输入交易对" options={['BTC/USDT','ETH/USDT','SOL/USDT'].map((s) => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="eventTypes" label="事件类型" rules={[{ required: true, message: '请选择至少一种事件类型' }]}><Select mode="multiple" placeholder="选择事件类型" options={EVENT_OPTIONS} /></Form.Item>
          <Form.Item name="rateLimit" label="频率限制 (/分钟)"><InputNumber min={1} max={60} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
