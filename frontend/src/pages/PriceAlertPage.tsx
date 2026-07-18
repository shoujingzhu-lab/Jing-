import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Tag, Modal, Form, InputNumber, Select, Switch, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined, BellOutlined } from '@ant-design/icons';
import { notificationApi } from '@/lib/api';
import EmptyState from '@/components/ui/EmptyState';
import type { PriceAlert } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function PriceAlertPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceAlert | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await notificationApi.getRules();
        const data = (res.data as unknown as { data: PriceAlert[] })?.data
          || (res.data as unknown as PriceAlert[]) || [];
        setAlerts(Array.isArray(data) ? data : []);
      } catch {
        // 后端未启动
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = () => {
    form.validateFields().then((vals) => {
      if (editing) {
        setAlerts((prev) => prev.map((a) => a.id === editing.id ? { ...a, ...vals } : a));
        message.success('告警已更新');
      } else {
        setAlerts((prev) => [{ id: `alert-${Date.now()}`, ...vals, currentPrice: vals.targetPrice, channels: vals.channels || ['site'] }, ...prev]);
        message.success('告警已创建');
      }
      setModalOpen(false); setEditing(null); form.resetFields();
    });
  };

  const handleDelete = (id: string) => {
    Modal.confirm({ title: '确认删除此价格告警？', okText: '删除', okButtonProps: { danger: true }, onOk: () => { setAlerts((prev) => prev.filter((a) => a.id !== id)); message.success('已删除'); } });
  };

  const openEdit = (a: PriceAlert) => { setEditing(a); form.setFieldsValue(a); setModalOpen(true); };

  const cols: ColumnsType<PriceAlert> = [
    { title: '交易对', dataIndex: 'symbol', width: 120, render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span> },
    { title: '条件', dataIndex: 'condition', width: 70, render: (v: string) => <Tag color={v === 'gte' ? 'green' : 'red'}>{v === 'gte' ? '≥' : '≤'}</Tag> },
    { title: '目标价', dataIndex: 'targetPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '当前价', dataIndex: 'currentPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '距目标', render: (_: unknown, r: PriceAlert) => {
      const diff = r.currentPrice ? ((r.targetPrice - r.currentPrice) / r.currentPrice * 100) : 0;
      return <span style={{ color: diff > 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}%</span>;
    }},
    { title: '通知方式', dataIndex: 'channels', width: 160, render: (v: string[]) => (v || []).map((c: string) => <Tag key={c} color="blue">{c === 'site' ? '站内' : c === 'email' ? '邮件' : c === 'telegram' ? 'Telegram' : c}</Tag>) },
    { title: '启用', dataIndex: 'enabled', width: 60, render: (v: boolean, r: PriceAlert) => <Switch checked={v} size="small" onChange={(chk) => setAlerts((prev) => prev.map((a) => a.id === r.id ? { ...a, enabled: chk } : a))} /> },
    { title: '状态', width: 100, render: (_: unknown, r: PriceAlert) =>
      r.triggeredAt ? <Tag color="success" icon={<BellOutlined />}>已触发</Tag> : <Tag>监控中</Tag>
    },
    { title: '过期', dataIndex: 'expiresAt', width: 120, render: (v?: string) => v ? new Date(v).toLocaleDateString('zh-CN') : <span style={{ color: 'var(--text-secondary)' }}>永久</span> },
    {
      title: '操作', width: 80, render: (_: unknown, r: PriceAlert) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>价格告警</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建告警</Button>
        </Space>
      </div>

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {!loading && alerts.length === 0 ? (
          <EmptyState title="暂无价格告警" description="创建价格告警以实时监控市场行情" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建告警</Button>} />
        ) : (
          <Table columns={cols} dataSource={alerts} rowKey="id" loading={loading} pagination={false} size="middle" />
        )}
      </Card>

      <Modal title={editing ? '编辑价格告警' : '新建价格告警'} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} width={500} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ condition: 'gte', channels: ['site'], enabled: true }}>
          <Form.Item name="symbol" label="交易对" rules={[{ required: true, message: '请选择交易对' }]}>
            <Select showSearch placeholder="选择交易对" options={['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','DOGE/USDT'].map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="condition" label="条件" rules={[{ required: true }]}>
              <Select style={{ width: 100 }} options={[{ value: 'gte', label: '≥ 大于等于' }, { value: 'lte', label: '≤ 小于等于' }]} />
            </Form.Item>
            <Form.Item name="targetPrice" label="目标价格 ($)" rules={[{ required: true, message: '请输入目标价格' }]}>
              <InputNumber style={{ width: 180 }} min={0} step={0.01} />
            </Form.Item>
          </Space>
          <Form.Item name="channels" label="通知方式">
            <Select mode="multiple" placeholder="选择通知方式" options={[
              { value: 'site', label: '站内通知' }, { value: 'email', label: '邮件' }, { value: 'telegram', label: 'Telegram' },
            ]} />
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间（可选）">
            <input type="date" style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
