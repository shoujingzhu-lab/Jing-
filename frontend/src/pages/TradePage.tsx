import { useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Button, Space, Alert, Tabs, Modal, Form, InputNumber, Select, Switch, message, Tooltip } from 'antd';
import { WarningOutlined, CloseOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import ConfirmModal from '@/components/ConfirmModal';
import { formatUSDT, formatCryptoAmount } from '@/lib/utils/format';
import type { Position, Order, OrderSide, OrderType, Exchange } from '@/lib/types';

// --- mock ---
const POSITIONS: Position[] = [
  { id: 'p1', symbol: 'BTC/USDT', exchange: 'binance', side: 'long', quantity: 0.5, entryPrice: 65800, markPrice: 67200, liquidationPrice: 32000, leverage: 5, margin: 6580, unrealizedPnl: 700, realizedPnl: 0, marginRatio: 0.35, riskLevel: 'safe', stopLoss: 63000, takeProfit: 72000 },
  { id: 'p2', symbol: 'ETH/USDT', exchange: 'okx', side: 'short', quantity: 5, entryPrice: 3480, markPrice: 3420, liquidationPrice: 5200, leverage: 3, margin: 5800, unrealizedPnl: 300, realizedPnl: 0, marginRatio: 0.42, riskLevel: 'safe' },
  { id: 'p3', symbol: 'SOL/USDT', exchange: 'binance', side: 'long', quantity: 50, entryPrice: 135, markPrice: 129, liquidationPrice: 68, leverage: 5, margin: 1350, unrealizedPnl: -300, realizedPnl: 0, marginRatio: 0.65, riskLevel: 'warning', stopLoss: 120 },
  { id: 'p4', symbol: 'DOGE/USDT', exchange: 'binance', side: 'long', quantity: 50000, entryPrice: 0.09, markPrice: 0.078, liquidationPrice: 0.072, leverage: 10, margin: 450, unrealizedPnl: -600, realizedPnl: 0, marginRatio: 0.88, riskLevel: 'danger' },
];

const ORDERS: Order[] = [
  { id: 'o1', symbol: 'BTC/USDT', exchange: 'binance', side: 'buy', type: 'limit', price: 66500, quantity: 0.1, filledQuantity: 0, status: 'submitted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'o2', symbol: 'ETH/USDT', exchange: 'okx', side: 'sell', type: 'limit', price: 3500, quantity: 2, filledQuantity: 1.2, status: 'partial_filled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// 模拟止盈止损编辑
function StopLossTakeProfitEdit({ position, positions, setPositions }: { position: Position; positions: Position[]; setPositions: React.Dispatch<React.SetStateAction<Position[]>> }) {
  const [sl, setSl] = useState(position.stopLoss?.toString() ?? '');
  const [tp, setTp] = useState(position.takeProfit?.toString() ?? '');
  const save = () => {
    setPositions(positions.map((p) => p.id === position.id ? { ...p, stopLoss: Number(sl) || undefined, takeProfit: Number(tp) || undefined } : p));
    message.success('止盈止损已更新');
  };
  return (
    <Space size="small">
      <InputNumber size="small" style={{ width: 90 }} placeholder="止损价" value={sl} onChange={(v) => setSl(v ?? '')} />
      <InputNumber size="small" style={{ width: 90 }} placeholder="止盈价" value={tp} onChange={(v) => setTp(v ?? '')} />
      <Button size="small" type="link" onClick={save}>保存</Button>
    </Space>
  );
}

export default function TradePage() {
  const [positions, setPositions] = useState<Position[]>(POSITIONS);
  const [orders, setOrders] = useState<Order[]>(ORDERS);
  const [showBalance, setShowBalance] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [orderForm] = Form.useForm();

  const totalEquity = 54320;
  const availableMargin = 32100;
  const usedMargin = 13730;
  const unrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const dangerPositions = positions.filter((p) => p.riskLevel === 'danger');

  // 下单
  const handlePlaceOrder = () => {
    orderForm.validateFields().then((vals) => {
      const newOrder: Order = {
        id: `o${Date.now()}`, symbol: vals.symbol, exchange: 'binance', side: vals.side,
        type: vals.type, price: vals.type === 'limit' ? vals.price : undefined, quantity: vals.quantity,
        filledQuantity: 0, status: 'submitted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setOrders((prev) => [newOrder, ...prev]);
      message.success('订单已提交');
      setOrderModalOpen(false);
      orderForm.resetFields();
    });
  };

  // 平仓确认
  const handleClosePosition = () => {
    if (!selectedPosition) return;
    Modal.confirm({
      title: `确认平仓 ${selectedPosition.symbol}？`,
      content: `将以市价平仓 ${selectedPosition.quantity} ${selectedPosition.symbol.split('/')[0]}，方向：${selectedPosition.side === 'long' ? '做多' : '做空'}`,
      okText: '确认平仓', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => {
        setPositions((prev) => prev.filter((p) => p.id !== selectedPosition.id));
        message.success(`${selectedPosition.symbol} 已平仓`);
        setCloseModalOpen(false);
      },
    });
  };

  // 撤单
  const cancelOrder = (id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    message.success('订单已撤销');
  };

  // 强平距离计算
  const getLiqDist = (p: Position) => {
    if (p.side === 'long') return ((p.markPrice - p.liquidationPrice) / p.markPrice * 100);
    return ((p.liquidationPrice - p.markPrice) / p.markPrice * 100);
  };

  return (
    <div>
      {/* 强平预警横幅 */}
      {dangerPositions.length > 0 && (
        <Alert
          type="error" banner showIcon icon={<WarningOutlined />}
          message={<span>⚠️ <strong>强平预警</strong> — {dangerPositions.map((p) => `${p.symbol} 保证金率 ${(p.marginRatio * 100).toFixed(0)}%，距强平 ${getLiqDist(p).toFixed(1)}%`).join('；')}</span>}
          action={<Button danger size="small" onClick={() => { dangerPositions.forEach((p) => message.warning(`请尽快处理 ${p.symbol}`)); }}>立即处理</Button>}
          style={{ marginBottom: 16, border: '2px solid var(--red-trade)', borderRadius: 6, animation: 'flash-red 1.5s ease-in-out infinite alternate' }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>实盘交易</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { orderForm.resetFields(); setOrderModalOpen(true); }}>下单</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><StatCard title="总权益" value={showBalance ? formatUSDT(totalEquity) : '****'} trend="up" /></Col>
        <Col xs={12} sm={6}><StatCard title="可用保证金" value={showBalance ? formatUSDT(availableMargin) : '****'} /></Col>
        <Col xs={12} sm={6}><StatCard title="占用保证金" value={formatUSDT(usedMargin)} /></Col>
        <Col xs={12} sm={6}>
          <StatCard
            title="未实现盈亏"
            value={unrealizedPnl >= 0 ? `+${formatUSDT(unrealizedPnl)}` : formatUSDT(unrealizedPnl)}
            trend={unrealizedPnl >= 0 ? 'up' : 'down'}
            // PnL 闪烁动画
            style={{ animation: unrealizedPnl !== 0 ? `flash-${unrealizedPnl >= 0 ? 'green' : 'red'} 1s ease-in-out` : undefined } as React.CSSProperties}
          />
        </Col>
      </Row>
      <Button size="small" type="link" onClick={() => setShowBalance(!showBalance)} style={{ margin: '4px 0 16px' }}>
        {showBalance ? '隐藏' : '显示'}余额
      </Button>

      <Tabs defaultActiveKey="positions" items={[
        {
          key: 'positions', label: `持仓 (${positions.length})`, children: (
            <Table<Position> dataSource={positions} rowKey="id" size="small" pagination={false}
              columns={[
                { title: '交易对', dataIndex: 'symbol', render: (s: string) => <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{s}</span> },
                { title: '方向', dataIndex: 'side', width: 60, render: (s: string) => <Tag color={s === 'long' ? 'green' : 'red'}>{s === 'long' ? '多' : '空'}</Tag> },
                { title: '数量', dataIndex: 'quantity', width: 80, render: (v: number, r: Position) => formatCryptoAmount(v, r.symbol) },
                { title: '开仓价', dataIndex: 'entryPrice', width: 100, render: (v: number) => `$${v.toLocaleString()}` },
                { title: '标记价', dataIndex: 'markPrice', width: 100, render: (v: number) => `$${v.toLocaleString()}` },
                { title: '强平价', dataIndex: 'liquidationPrice', width: 100, render: (v: number, r: Position) => {
                  const dist = getLiqDist(r);
                  return <Tooltip title={`距强平 ${dist.toFixed(1)}%`}><span style={{ color: dist < 10 ? 'var(--red-trade)' : 'var(--warning)', fontFamily: "'JetBrains Mono', monospace" }}>${v.toLocaleString()}</span></Tooltip>;
                }},
                { title: '未实现盈亏', dataIndex: 'unrealizedPnl', width: 110, align: 'right' as const,
                  render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{formatUSDT(v)}</span> },
                { title: '杠杆', dataIndex: 'leverage', width: 60, render: (v: number) => `${v}x` },
                { title: '止盈/止损', width: 170, render: (_: unknown, r: Position) => <StopLossTakeProfitEdit position={r} positions={positions} setPositions={setPositions} /> },
                { title: '操作', width: 140, render: (_: unknown, r: Position) => (
                  <Space size="small">
                    <Button size="small" danger onClick={() => { setSelectedPosition(r); setCloseModalOpen(true); }}>平仓</Button>
                  </Space>
                )},
              ]}
            />
          ),
        },
        {
          key: 'orders', label: `挂单 (${orders.length})`, children: (
            <Table<Order> dataSource={orders} rowKey="id" size="small" pagination={false}
              columns={[
                { title: '交易对', dataIndex: 'symbol' },
                { title: '方向', dataIndex: 'side', width: 60, render: (s: string) => <Tag color={s === 'buy' ? 'green' : 'red'}>{s === 'buy' ? '买' : '卖'}</Tag> },
                { title: '价格', dataIndex: 'price', width: 100, render: (v?: number) => v ? `$${v.toLocaleString()}` : '市价' },
                { title: '数量', dataIndex: 'quantity', width: 80 },
                { title: '已成交', dataIndex: 'filledQuantity', width: 80 },
                { title: '状态', dataIndex: 'status', width: 100, render: (s: string) => <StatusTag status={s} statusMap={{ submitted: { label: '已提交', color: 'processing' }, partial_filled: { label: '部分成交', color: 'blue' } } as Record<string, { label: string; color: string }>} /> },
                { title: '操作', key: 'actions', width: 60, render: (_: unknown, r: Order) => <Button size="small" type="link" danger icon={<CloseOutlined />} onClick={() => cancelOrder(r.id)}>撤单</Button> },
              ]}
            />
          ),
        },
        { key: 'history', label: '历史成交', children: <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>📜 历史成交记录列表 — 将在后续阶段实现</div> },
      ]} />

      {/* 下单弹窗 */}
      <Modal title="下单" open={orderModalOpen} onCancel={() => setOrderModalOpen(false)} onOk={handlePlaceOrder} okText="提交订单" width={480} destroyOnClose>
        <Form form={orderForm} layout="vertical" initialValues={{ symbol: 'BTC/USDT', side: 'buy', type: 'limit', quantity: 0.01 }}>
          <Form.Item name="symbol" label="交易对" rules={[{ required: true }]}>
            <Select options={['BTC/USDT','ETH/USDT','SOL/USDT','DOGE/USDT'].map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Space size="middle">
            <Form.Item name="side" label="方向" rules={[{ required: true }]}>
              <Select style={{ width: 100 }} options={[{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }]} />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select style={{ width: 120 }} options={[{ value: 'market', label: '市价' }, { value: 'limit', label: '限价' }, { value: 'stop_loss', label: '止损' }, { value: 'take_profit', label: '止盈' }]} />
            </Form.Item>
          </Space>
          <Form.Item name="price" label="价格 (限价单必填)">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="市价单可不填" />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.0001} step={0.01} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 平仓确认弹窗 */}
      <ConfirmModal
        open={closeModalOpen}
        title="确认平仓"
        content={selectedPosition ? `将以市价平仓 ${selectedPosition.quantity} ${selectedPosition.symbol}（${selectedPosition.side === 'long' ? '多头' : '空头'}）` : ''}
        danger
        confirmText="确认平仓"
        onConfirm={handleClosePosition}
        onCancel={() => setCloseModalOpen(false)}
      />
    </div>
  );
}
