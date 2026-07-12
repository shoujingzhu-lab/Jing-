import { useState } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { mockExchangeStatus, mockDelay } from '@/lib/mock';
import StatusTag from '@/components/ui/StatusTag';
import EmptyState from '@/components/ui/EmptyState';
import type { ColumnsType } from 'antd/es/table';

interface ExchangeConfig { id: string; exchange: string; apiKey: string; apiSecret: string; status: string; latency: number; successRate: number }

const MOCK_EXCHANGES: ExchangeConfig[] = [
  { id: 'ex-1', exchange: 'binance', apiKey: 'bin_****a1b2', apiSecret: '••••••••', status: 'connected', latency: 85, successRate: 0.998 },
  { id: 'ex-2', exchange: 'okx', apiKey: 'okx_****c3d4', apiSecret: '••••••••', status: 'reconnecting', latency: 120, successRate: 0.992 },
  { id: 'ex-3', exchange: 'bybit', apiKey: 'byb_****e5f6', apiSecret: '••••••••', status: 'connected', latency: 95, successRate: 0.997 },
];

export default function AdminExchangesPage() {
  const [exchanges, setExchanges] = useState<ExchangeConfig[]>(MOCK_EXCHANGES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExchangeConfig | null>(null);
  const [form] = Form.useForm();

  const handleSave = () => {
    form.validateFields().then((vals) => {
      if (editing) {
        setExchanges((prev) => prev.map((e) => e.id === editing.id ? { ...e, ...vals } : e));
      } else {
        setExchanges((prev) => [...prev, { id: `ex-${Date.now()}`, ...vals, status: 'connected', latency: 0, successRate: 1.0 }]);
      }
      message.success(editing ? '已更新' : '已添加');
      setModalOpen(false); setEditing(null); form.resetFields();
    });
  };

  const cols: ColumnsType<ExchangeConfig> = [
    { title: '交易所', dataIndex: 'exchange', width: 100, render: (v: string) => <Tag color="blue">{v.toUpperCase()}</Tag> },
    { title: 'API Key', dataIndex: 'apiKey', width: 160, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: '状态', dataIndex: 'status', width: 110, render: (v: string) => <StatusTag status={v} statusMap={{ connected: { label: '已连接', color: 'green' }, reconnecting: { label: '重连中', color: 'warning' }, disconnected: { label: '断开', color: 'error' } } as Record<string, { label: string; color: string }>} /> },
    { title: '延迟', dataIndex: 'latency', width: 80, render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v}ms</span> },
    { title: '24h成功率', dataIndex: 'successRate', width: 110, render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" strokeColor={v > 0.99 ? '#26A69A' : '#FF9800'} /> },
    {
      title: '操作', width: 120, render: (_: unknown, r: ExchangeConfig) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => { setExchanges((prev) => prev.filter((e) => e.id !== r.id)); message.success('已删除'); }} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>交易所管理</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>添加交易所</Button>
        </Space>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {exchanges.length === 0 ? (
          <EmptyState title="未配置交易所" description="添加交易所 API 配置以连接交易" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加交易所</Button>} />
        ) : (
          <Table columns={cols} dataSource={exchanges} rowKey="id" pagination={false} size="middle" />
        )}
      </Card>
      <Modal title={editing ? '编辑交易所' : '添加交易所'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} onOk={handleSave} okText="保存" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="exchange" label="交易所" rules={[{ required: true }]}><Select options={['binance','okx','bybit','gate'].map((v) => ({ value: v, label: v.toUpperCase() }))} /></Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}><Input placeholder="输入 API Key" /></Form.Item>
          <Form.Item name="apiSecret" label="API Secret" rules={[{ required: true }]}><Input.Password placeholder="输入 API Secret" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
