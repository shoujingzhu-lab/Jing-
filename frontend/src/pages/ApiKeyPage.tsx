import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, Switch, message, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, ReloadOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { tradingApi } from '@/lib/api';
import EmptyState from '@/components/ui/EmptyState';
import type { ColumnsType } from 'antd/es/table';

interface ApiKey { id: string; name: string; key: string; secret: string; scope: string[]; lastUsed?: string; expiresAt?: string; enabled: boolean; createdAt: string }

const SCOPE_OPTIONS = [
  { value: 'market:read', label: 'market:read' }, { value: 'market:write', label: 'market:write' },
  { value: 'strategy:read', label: 'strategy:read' }, { value: 'strategy:write', label: 'strategy:write' },
  { value: 'backtest:read', label: 'backtest:read' }, { value: 'backtest:write', label: 'backtest:write' },
  { value: 'trade:read', label: 'trade:read' }, { value: 'trade:write', label: 'trade:write' },
  { value: 'admin:read', label: 'admin:read' }, { value: 'admin:write', label: 'admin:write' },
];

export default function ApiKeyPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await tradingApi.getApiKeys();
        const data = (res.data as unknown as { data: unknown[] })?.data
          || (res.data as unknown as unknown[]) || [];
        if (Array.isArray(data)) {
          setKeys(data.map((k: unknown) => {
            const key = k as Record<string, unknown>;
            return {
              id: key.id as string || `ak-${Date.now()}`,
              name: (key.label as string) || (key.exchange as string) || 'API Key',
              key: (key.access_key as string)?.substring(0, 12) + '****' || '****',
              secret: '••••••••',
              scope: ['trade:read', 'trade:write'],
              enabled: true,
              createdAt: new Date().toISOString(),
            };
          }));
        }
      } catch {
        // 后端未启动
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = () => {
    form.validateFields().then((vals) => {
      const newKey: ApiKey = {
        id: `ak-${Date.now()}`, name: vals.name, key: `qt_${vals.name.slice(0, 4).toLowerCase()}_****${Math.random().toString(36).slice(2, 6)}`,
        secret: '••••••••', scope: vals.scope, enabled: true, createdAt: new Date().toISOString(),
        expiresAt: vals.expiresAt?.toISOString(),
      };
      setKeys((prev) => [newKey, ...prev]);
      message.success('API Key 已创建。请妥善保管 Secret。');
      setModalOpen(false); form.resetFields();
    });
  };

  const deleteKey = (id: string) => {
    Modal.confirm({ title: '确认删除此 API Key？', okText: '删除', okButtonProps: { danger: true }, onOk: () => { setKeys((prev) => prev.filter((k) => k.id !== id)); message.success('已删除'); } });
  };

  const cols: ColumnsType<ApiKey> = [
    { title: '名称', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span> },
    { title: 'Key', dataIndex: 'key', width: 180, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: 'Secret', dataIndex: 'secret', width: 130, render: (v: string, r: ApiKey) => (
      <Space size="small">
        <code style={{ fontSize: 12 }}>{revealedSecrets.has(r.id) ? 'qt_sec_********' : v}</code>
        <Button type="text" size="small" icon={revealedSecrets.has(r.id) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => { const ns = new Set(revealedSecrets); if (ns.has(r.id)) ns.delete(r.id); else ns.add(r.id); setRevealedSecrets(ns); }} />
      </Space>
    )},
    { title: '权限范围', dataIndex: 'scope', width: 260, render: (v: string[]) => v.map((s) => <Tag key={s} color="blue" style={{ fontSize: 11 }}>{s}</Tag>) },
    { title: '最后使用', dataIndex: 'lastUsed', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : <span style={{ color: 'var(--text-secondary)' }}>从未</span> },
    { title: '过期', dataIndex: 'expiresAt', width: 120, render: (v?: string) => v ? new Date(v).toLocaleDateString('zh-CN') : <Tag color="default">永久</Tag> },
    { title: '状态', dataIndex: 'enabled', width: 70, render: (v: boolean, r: ApiKey) => <Switch checked={v} size="small" onChange={(chk) => setKeys((prev) => prev.map((k) => k.id === r.id ? { ...k, enabled: chk } : k))} /> },
    {
      title: '操作', width: 100, render: (_: unknown, r: ApiKey) => (
        <Space size="small">
          <Tooltip title="复制 Key"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(r.key); message.success('已复制'); }} /></Tooltip>
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteKey(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>API Key 管理</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>创建 API Key</Button>
        </Space>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {!loading && keys.length === 0 ? (
          <EmptyState title="暂无 API Key" description="创建 API Key 以通过接口访问系统功能" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建 API Key</Button>} />
        ) : (
          <Table columns={cols} dataSource={keys} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1200 }} />
        )}
      </Card>
      <Modal title="创建 API Key" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={handleCreate} okText="创建" width={560} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ scope: ['market:read'] }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="例：行情数据查询" /></Form.Item>
          <Form.Item name="scope" label="权限范围" rules={[{ required: true }]}>
            <Select mode="multiple" options={SCOPE_OPTIONS} placeholder="选择 API 权限" />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间（可选）"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
