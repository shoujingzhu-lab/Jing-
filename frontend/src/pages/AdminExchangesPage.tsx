import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Modal, Form, Input, Select, message, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { adminApi, tradingApi } from '@/lib/api';
import StatusTag from '@/components/ui/StatusTag';
import EmptyState from '@/components/ui/EmptyState';
import type { ExchangeStatus } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

interface ExchangeConfig { id: string; exchange: string; apiKey: string; apiSecret: string; status: string; latency: number; successRate: number }

export default function AdminExchangesPage() {
  const [exchanges, setExchanges] = useState<ExchangeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExchangeConfig | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const load = async () => {
      try {
        const [exStatusRes, apiKeysRes] = await Promise.allSettled([
          adminApi.getExchangeStatus(),
          tradingApi.getApiKeys(),
        ]);

        const configs: ExchangeConfig[] = [];

        // 从交易所状态获取连接信息
        if (exStatusRes.status === 'fulfilled') {
          const statuses = ((exStatusRes.value.data as unknown as { data: ExchangeStatus[] })?.data
            || (exStatusRes.value.data as unknown as ExchangeStatus[]) || []) as ExchangeStatus[];
          statuses.forEach((s: ExchangeStatus, i: number) => {
            configs.push({
              id: `ex-${s.exchange || i}`,
              exchange: s.exchange,
              apiKey: '****',
              apiSecret: '••••••••',
              status: s.wsStatus || 'disconnected',
              latency: s.restLatency || 0,
              successRate: s.successRate24h || 0,
            });
          });
        }

        // 从 API Keys 获取绑定的 key 信息
        if (apiKeysRes.status === 'fulfilled') {
          const keys = ((apiKeysRes.value.data as unknown as { data: unknown[] })?.data
            || (apiKeysRes.value.data as unknown as unknown[]) || []) as Array<Record<string, unknown>>;
          keys.forEach((k: Record<string, unknown>, i: number) => {
            const existing = configs.find((c) => c.exchange === k.exchange);
            if (existing) {
              existing.apiKey = (k.label as string) || (k.access_key as string)?.substring(0, 8) + '****' || '****';
            } else {
              configs.push({
                id: `ex-key-${k.id || i}`,
                exchange: (k.exchange as string) || 'unknown',
                apiKey: (k.label as string) || '****',
                apiSecret: '••••••••',
                status: 'connected',
                latency: 0,
                successRate: 1.0,
              });
            }
          });
        }

        setExchanges(configs);
      } catch {
        // 后端未启动时为空
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
        {!loading && exchanges.length === 0 ? (
          <EmptyState title="未配置交易所" description="添加交易所 API 配置以连接交易" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加交易所</Button>} />
        ) : (
          <Table columns={cols} dataSource={exchanges} rowKey="id" loading={loading} pagination={false} size="middle" />
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
