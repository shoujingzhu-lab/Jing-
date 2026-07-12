import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Tabs, Tag, Space, Select, message } from 'antd';
import { PlusOutlined, ReloadOutlined, LinkOutlined, StopOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { mockDelay } from '@/lib/mock';
import { EXCHANGE_MAP } from '@/lib/constants';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import BaseChart from '@/components/Chart/BaseChart';
import type { TradingAccount, Position, Order, Trade } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

// ---- mock data ----
const ACCOUNT: TradingAccount = {
  id: 'sim-001', name: '测试账户 A', type: 'contract', isSim: true, exchange: 'binance',
  initialCapital: 10000, currentEquity: 12350.5, availableMargin: 8450.3, usedMargin: 3900.2,
  unrealizedPnl: 180.5, realizedPnl: 2170, todayPnl: 234.5, totalReturn: 0.235, totalReturnPercent: 23.5, activeStrategies: 2, createdAt: '2025-06-01T00:00:00Z',
};

const POSITIONS: Position[] = [
  { id: 'p1', symbol: 'BTC/USDT', exchange: 'binance', side: 'long', quantity: 0.15, entryPrice: 45200, markPrice: 46800, liquidationPrice: 38500, leverage: 5, margin: 1356, unrealizedPnl: 240, realizedPnl: 0, stopLoss: 44200, takeProfit: 49000, marginRatio: 0.35, riskLevel: 'safe' },
  { id: 'p2', symbol: 'ETH/USDT', exchange: 'binance', side: 'long', quantity: 5, entryPrice: 3200, markPrice: 3150, liquidationPrice: 2850, leverage: 3, margin: 5333, unrealizedPnl: -250, realizedPnl: 0, stopLoss: 3050, marginRatio: 0.55, riskLevel: 'warning' },
];

const ORDERS: Order[] = [
  { id: 'o1', symbol: 'BTC/USDT', exchange: 'binance', side: 'buy', type: 'limit', price: 45000, quantity: 0.1, filledQuantity: 0, status: 'submitted', createdAt: '2026-06-07T10:00:00Z', updatedAt: '2026-06-07T10:00:00Z' },
  { id: 'o2', symbol: 'SOL/USDT', exchange: 'binance', side: 'sell', type: 'stop_loss', price: 180, quantity: 10, filledQuantity: 0, status: 'submitted', createdAt: '2026-06-07T09:30:00Z', updatedAt: '2026-06-07T09:30:00Z' },
];

const TRADES: Trade[] = [
  { id: 't1', orderId: 'o3', symbol: 'BTC/USDT', exchange: 'binance', side: 'buy', price: 45200, quantity: 0.05, fee: 2.26, feeCurrency: 'USDT', realizedPnl: 0, time: '2026-06-07T08:15:00Z' },
  { id: 't2', orderId: 'o4', symbol: 'ETH/USDT', exchange: 'binance', side: 'sell', price: 3250, quantity: 2, fee: 6.5, feeCurrency: 'USDT', realizedPnl: 100, time: '2026-06-07T07:45:00Z' },
  { id: 't3', orderId: 'o5', symbol: 'SOL/USDT', exchange: 'binance', side: 'buy', price: 185, quantity: 20, fee: 3.7, feeCurrency: 'USDT', realizedPnl: 0, time: '2026-06-07T06:30:00Z' },
];

// ---- equity curve data ----
const EQUITY_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  value: Math.round((10000 + Math.sin(i / 5) * 1000 + i * 80) * 100) / 100,
}));

export default function SimAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockDelay(null, 400).then(() => setLoading(false));
  }, [accountId]);

  if (loading) {
    return (
      <div>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>模拟账户详情</Typography.Title>
        <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div></Card>
      </div>
    );
  }

  const posCols: ColumnsType<Position> = [
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 70, render: (v: string) => <Tag color={v === 'long' ? 'green' : 'red'}>{v === 'long' ? '做多' : '做空'}</Tag> },
    { title: '数量', dataIndex: 'quantity' },
    { title: '开仓价', dataIndex: 'entryPrice', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '标记价', dataIndex: 'markPrice', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '强平价', dataIndex: 'liquidationPrice', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '杠杆', dataIndex: 'leverage', render: (v: number) => `${v}x` },
    { title: '未实现盈亏', dataIndex: 'unrealizedPnl', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>${v.toFixed(2)}</span> },
    { title: '保证金率', dataIndex: 'marginRatio', render: (v: number) => <span style={{ color: v > 0.7 ? 'var(--red-trade)' : v > 0.4 ? '#FF9800' : 'var(--green-trade)' }}>{(v * 100).toFixed(1)}%</span> },
  ];

  const ordCols: ColumnsType<Order> = [
    { title: '交易对', dataIndex: 'symbol' },
    { title: '方向', dataIndex: 'side', render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买入' : '卖出'}</Tag> },
    { title: '类型', dataIndex: 'type' },
    { title: '价格', dataIndex: 'price', render: (v: number) => v ? `$${v.toLocaleString()}` : '市价' },
    { title: '数量', dataIndex: 'quantity' },
    { title: '已成交', dataIndex: 'filledQuantity' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} statusMap={{ submitted: { label: '已提交', color: 'processing' }, partial_filled: { label: '部分成交', color: 'blue' }, filled: { label: '全部成交', color: 'success' }, cancelled: { label: '已撤销', color: 'warning' } } as Record<string, { label: string; color: string }>} /> },
  ];

  const tradeCols: ColumnsType<Trade> = [
    { title: '交易对', dataIndex: 'symbol' },
    { title: '方向', dataIndex: 'side', render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买入' : '卖出'}</Tag> },
    { title: '价格', dataIndex: 'price', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '数量', dataIndex: 'quantity' },
    { title: '手续费', dataIndex: 'fee', render: (v: number, r: Trade) => `${v} ${r.feeCurrency}` },
    { title: '时间', dataIndex: 'time', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>{ACCOUNT.name}</Typography.Title>
          <Tag color="blue">模拟</Tag>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{EXCHANGE_MAP[ACCOUNT.exchange]}</span>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('下单功能将在后续实现')}>新建订单</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}><StatCard title="当前净值" value={ACCOUNT.currentEquity} format="usdt" trend="up" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="总收益率" value={ACCOUNT.totalReturnPercent} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="今日盈亏" value={ACCOUNT.todayPnl} format="usdt" trend={ACCOUNT.todayPnl >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="可用保证金" value={ACCOUNT.availableMargin} format="usdt" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="已用保证金" value={ACCOUNT.usedMargin} format="usdt" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="活跃策略" value={ACCOUNT.activeStrategies} format="number" /></Col>
      </Row>

      <Card title="净值曲线" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <BaseChart type="line" data={EQUITY_DATA} xField="date" yField="value" height={280} />
      </Card>

      <Card title="已绑定策略" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Space>
          <Tag closable color="blue">EMA金叉策略</Tag>
          <Tag closable color="blue">RSI超卖反弹</Tag>
          <Button type="dashed" icon={<LinkOutlined />} size="small">绑定策略</Button>
        </Space>
      </Card>

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Tabs defaultActiveKey="positions" items={[
          { key: 'positions', label: `持仓 (${POSITIONS.length})`, children: <Table columns={posCols} dataSource={POSITIONS} rowKey="id" pagination={false} size="middle" scroll={{ x: 1000 }} /> },
          { key: 'orders', label: `挂单 (${ORDERS.length})`, children: <Table columns={ordCols} dataSource={ORDERS} rowKey="id" pagination={false} size="middle" /> },
          { key: 'trades', label: `成交 (${TRADES.length})`, children: <Table columns={tradeCols} dataSource={TRADES} rowKey="id" pagination={false} size="middle" /> },
        ]} />
      </Card>
    </div>
  );
}
