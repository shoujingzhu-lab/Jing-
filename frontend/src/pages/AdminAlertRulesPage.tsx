import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Switch, Modal, Form, Select, InputNumber, Input, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { mockAlertRules, mockDelay } from '@/lib/mock';
import StatusTag from '@/components/ui/StatusTag';
import EmptyState from '@/components/ui/EmptyState';
import type { SystemAlertRule } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function AdminAlertRulesPage() {
  const [rules, setRules] = useState<SystemAlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemAlertRule | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { mockDelay(mockAlertRules(), 400).then((r) => { setRules(r); setLoading(false); }); }, []);

  const handleSave = () => {
    form.validateFields().then((vals) => {
      if (editing) {
        setRules((prev) => prev.map((r) => r.id === editing.id ? { ...r, ...vals } : r));
      } else {
        setRules((prev) => [...prev, { id: `rule-${Date.now()}`, ...vals }]);
      }
      message.success(editing ? '规则已更新' : '规则已创建');
      setModalOpen(false); setEditing(null); form.resetFields();
    });
  };

  const cols: ColumnsType<SystemAlertRule> = [
    { title: '规则名称', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span> },
    { title: '条件', dataIndex: 'condition', render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '级别', dataIndex: 'severity', width: 90, render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'serious' ? 'orange' : v === 'warning' ? 'gold' : 'blue'}>{v === 'critical' ? '严重' : v === 'serious' ? '重要' : v === 'warning' ? '警告' : '信息'}</Tag> },
    { title: '通知对象', dataIndex: 'notifyTarget', width: 160, render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: '冷却时间(s)', dataIndex: 'cooldown', width: 100 },
    { title: '启用', dataIndex: 'enabled', width: 60, render: (v: boolean, r: SystemAlertRule) => <Switch checked={v} size="small" onChange={(chk) => setRules((prev) => prev.map((x) => x.id === r.id ? { ...x, enabled: chk } : x))} /> },
    {
      title: '操作', width: 100, render: (_: unknown, r: SystemAlertRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => { setRules((prev) => prev.filter((x) => x.id !== r.id)); message.success('已删除'); }} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>系统告警规则</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>新建规则</Button>
        </Space>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {!loading && rules.length === 0 ? (
          <EmptyState title="暂无告警规则" description="创建系统告警规则以监控系统运行状态" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建规则</Button>} />
        ) : (
          <Table columns={cols} dataSource={rules} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1000 }} />
        )}
      </Card>
      <Modal title={editing ? '编辑告警规则' : '新建告警规则'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }} onOk={handleSave} okText="保存" width={560} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ severity: 'warning', cooldown: 300, enabled: true }}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input placeholder="例：CPU 使用率告警" /></Form.Item>
          <Form.Item name="condition" label="触发条件" rules={[{ required: true }]}><Input placeholder="例：cpu_usage > 90% 持续 5min" /></Form.Item>
          <Form.Item name="severity" label="严重级别" rules={[{ required: true }]}><Select options={[{ value: 'info', label: '信息' }, { value: 'warning', label: '警告' }, { value: 'serious', label: '重要' }, { value: 'critical', label: '严重' }]} /></Form.Item>
          <Form.Item name="notifyTarget" label="通知对象" rules={[{ required: true }]}><Input placeholder="例：admin+钉钉群" /></Form.Item>
          <Form.Item name="cooldown" label="冷却时间 (秒)"><InputNumber min={30} max={3600} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
