import { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Modal, Form, Input, Select, Switch, message, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import EmptyState from '@/components/ui/EmptyState';
import StatusTag from '@/components/ui/StatusTag';
import type { OrderRoutingRule } from '@/lib/types';

const MOCK_RULES: OrderRoutingRule[] = [
  { id: 'r1', name: 'BTC 最优价格路由', exchanges: ['binance', 'okx'], strategy: 'best_price', failoverEnabled: true, symbols: ['BTC/USDT'], enabled: true },
  { id: 'r2', name: 'ETH 低手续费路由', exchanges: ['binance', 'bybit'], strategy: 'lowest_fee', failoverEnabled: true, symbols: ['ETH/USDT'], enabled: true },
  { id: 'r3', name: 'SOL 指定优先', exchanges: ['binance'], strategy: 'designated_priority', failoverEnabled: false, symbols: ['SOL/USDT'], enabled: false },
];

const LABELS: Record<string, string> = { best_price: '最优价格', lowest_fee: '最低手续费', designated_priority: '指定优先', smart: '智能分配' };

export default function OrderRoutingPage() {
  const [rules, setRules] = useState(MOCK_RULES);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<OrderRoutingRule | null>(null);
  const [form] = Form.useForm();

  const handleSave = () => {
    form.validateFields().then((values) => {
      if (editingRule) {
        setRules(rules.map((r) => (r.id === editingRule.id ? { ...r, ...values } : r)));
      } else {
        setRules([...rules, { id: String(Date.now()), ...values }]);
      }
      message.success(editingRule ? '已更新' : '已创建');
      setShowModal(false); setEditingRule(null); form.resetFields();
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>订单路由配置</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRule(null); form.resetFields(); setShowModal(true); }}>添加规则</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {rules.length === 0 ? (
          <EmptyState title="还没有路由规则" description="配置订单路由规则让订单自动选择最优交易所执行" actionText="添加规则" onAction={() => setShowModal(true)} />
        ) : (
          <Table dataSource={rules} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '规则名', dataIndex: 'name', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
              { title: '策略', dataIndex: 'strategy', width: 120, render: (s: string) => <Tag color="blue">{LABELS[s]}</Tag> },
              { title: '交易所', dataIndex: 'exchanges', width: 180, render: (exs: string[]) => <Space>{exs.map((e) => <Tag key={e}>{e.toUpperCase()}</Tag>)}</Space> },
              { title: '故障转移', dataIndex: 'failoverEnabled', width: 80, render: (v: boolean) => <StatusTag status={v ? 'success' : 'default'} label={v ? '已启用' : '已禁用'} /> },
              { title: '状态', dataIndex: 'enabled', width: 80, render: (v: boolean) => <StatusTag status={v ? 'green' : 'default'} label={v ? '启用' : '停用'} /> },
              { title: '操作', key: 'actions', width: 120, render: (_: unknown, r: OrderRoutingRule) => (
                <Space>
                  <Button size="small" type="link" icon={<EditOutlined />} onClick={() => { setEditingRule(r); form.setFieldsValue(r); setShowModal(true); }} />
                  <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => { setRules(rules.filter((x) => x.id !== r.id)); }} />
                </Space>
              )},
            ]}
          />
        )}
      </Card>
      <Modal title={editingRule ? '编辑路由规则' : '添加路由规则'} open={showModal}
        onCancel={() => { setShowModal(false); setEditingRule(null); }} onOk={handleSave} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="strategy" label="路由策略" rules={[{ required: true }]}>
            <Select options={[
              { value: 'best_price', label: '最优价格' }, { value: 'lowest_fee', label: '最低手续费' },
              { value: 'designated_priority', label: '指定优先' }, { value: 'smart', label: '智能分配' },
            ]} />
          </Form.Item>
          <Form.Item name="exchanges" label="交易所" rules={[{ required: true }]}>
            <Select mode="multiple" options={[{ value: 'binance', label: 'Binance' }, { value: 'okx', label: 'OKX' }, { value: 'bybit', label: 'Bybit' }, { value: 'gate', label: 'Gate.io' }]} />
          </Form.Item>
          <Form.Item name="failoverEnabled" label="故障转移" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
