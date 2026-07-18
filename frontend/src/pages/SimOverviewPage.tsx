import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Table, Tag, Modal, Form, Input, InputNumber, Select, Space, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { simApi } from '@/lib/api';
import { formatUSDT, formatPercent } from '@/lib/utils/format';
import type { TradingAccount } from '@/lib/types';

export default function SimOverviewPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await simApi.getAccounts();
        const data = (res.data as unknown as { data: TradingAccount[] })?.data
          || (res.data as unknown as TradingAccount[]) || [];
        setAccounts(Array.isArray(data) ? data : []);
      } catch {
        // 后端未启动或暂无数据
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalEquity = accounts.reduce((s, a) => s + (a.currentEquity ?? 0), 0);
  const totalTodayPnl = accounts.reduce((s, a) => s + (a.todayPnl ?? 0), 0);
  const totalAvailable = accounts.reduce((s, a) => s + (a.availableMargin ?? 0), 0);
  const totalUsed = accounts.reduce((s, a) => s + (a.usedMargin ?? 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>模拟交易</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>新建模拟账户</Button>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}><StatCard title="总资产" value={formatUSDT(totalEquity)} trend={totalTodayPnl >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="今日盈亏" value={totalTodayPnl >= 0 ? `+${formatUSDT(totalTodayPnl)}` : formatUSDT(totalTodayPnl)} trend={totalTodayPnl >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="可用保证金" value={formatUSDT(totalAvailable)} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="占用保证金" value={formatUSDT(totalUsed)} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="模拟账户数" value={String(accounts.length)} suffix=" 个" /></Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>快捷操作</div>
            <Space size="small">
              <Button size="small" type="primary" ghost onClick={() => message.info('充值功能将在后续实现')}>充值</Button>
              <Button size="small" onClick={() => message.info('重置功能将在后续实现')}>重置</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="模拟账户" style={{ marginTop: 16, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {!loading && accounts.length === 0 ? (
          <EmptyState title="还没有模拟账户" description="创建模拟账户来测试你的策略" actionText="新建模拟账户" onAction={() => setShowCreate(true)} />
        ) : (
          <Table dataSource={accounts} rowKey="id" size="small" loading={loading} pagination={false}
            onRow={(r) => ({ onClick: () => navigate(`/sim/${r.id}`), style: { cursor: 'pointer' } })}
            columns={[
              { title: '名称', dataIndex: 'name', key: 'name', render: (n: string, r: TradingAccount) => <a style={{ fontWeight: 500 }} onClick={() => navigate(`/sim/${r.id}`)}>{n}</a> },
              { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (t: string) => <Tag>{t === 'spot' ? '现货' : '合约'}</Tag> },
              { title: '初始资金', dataIndex: 'initialCapital', key: 'initialCapital', render: (v: number) => formatUSDT(v ?? 0) },
              { title: '当前净值', dataIndex: 'currentEquity', key: 'currentEquity', render: (v: number) => <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{formatUSDT(v ?? 0)}</span> },
              { title: '收益率', dataIndex: 'totalReturnPercent', key: 'totalReturnPercent', render: (v: number) => <span style={{ color: (v ?? 0) >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600 }}>{(v ?? 0) >= 0 ? '+' : ''}{(v ?? 0).toFixed(2)}%</span> },
              { title: '策略数', dataIndex: 'activeStrategies', key: 'activeStrategies' },
              { title: '操作', key: 'actions', width: 100, render: () => <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button> },
            ]}
          />
        )}
      </Card>

      <Modal title="新建模拟账户" open={showCreate} onCancel={() => setShowCreate(false)}
        onOk={async () => {
          try {
            const vals = await form.validateFields();
            await simApi.createAccount({ name: vals.name, account_type: vals.type, initial_capital: vals.initialCapital });
            message.success('账户创建成功');
            setShowCreate(false);
            // 刷新列表
            const res = await simApi.getAccounts();
            const data = (res.data as unknown as { data: TradingAccount[] })?.data
              || (res.data as unknown as TradingAccount[]) || [];
            setAccounts(Array.isArray(data) ? data : []);
          } catch {
            message.error('创建失败');
          }
        }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="账户名称" rules={[{ required: true }]}><Input placeholder="如：BTC 网格策略测试" /></Form.Item>
          <Form.Item name="type" label="账户类型" rules={[{ required: true }]}>
            <Select options={[{ value: 'spot', label: '现货' }, { value: 'contract', label: '合约' }]} />
          </Form.Item>
          <Form.Item name="initialCapital" label="初始资金 (USDT)" rules={[{ required: true }]}>
            <InputNumber min={100} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
