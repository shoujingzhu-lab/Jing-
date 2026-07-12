import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Tabs, Tag, Space, Select, Alert, message, Progress } from 'antd';
import { PlusOutlined, ReloadOutlined, LinkOutlined, WarningOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { EXCHANGE_MAP, RISK_LEVEL_MAP } from '@/lib/constants';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import ConfirmModal from '@/components/ConfirmModal';
import BaseChart from '@/components/Chart/BaseChart';
import type { TradingAccount, Position, Order, Trade } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

// ---- mock ----
const ACCOUNT: TradingAccount = {
  id: 'live-001', name: '主交易账户', type: 'contract', isSim: false, exchange: 'binance',
  initialCapital: 50000, currentEquity: 57680.5, availableMargin: 43200, usedMargin: 14480.5,
  unrealizedPnl: 520, realizedPnl: 7160.5, todayPnl: 340, totalReturn: 0.1536, totalReturnPercent: 15.36,
  activeStrategies: 3, createdAt: '2025-12-01T00:00:00Z',
};

const POSITIONS: Position[] = [
  { id: 'lp1', symbol: 'BTC/USDT', exchange: 'binance', side: 'long', quantity: 0.3, entryPrice: 45200, markPrice: 46800, liquidationPrice: 38500, leverage: 5, margin: 2712, unrealizedPnl: 480, realizedPnl: 0, stopLoss: 44200, takeProfit: 50000, marginRatio: 0.32, riskLevel: 'safe' },
  { id: 'lp2', symbol: 'ETH/USDT', exchange: 'binance', side: 'long', quantity: 8, entryPrice: 3200, markPrice: 3220, liquidationPrice: 2850, leverage: 3, margin: 8533, unrealizedPnl: 160, realizedPnl: 0, stopLoss: 3100, marginRatio: 0.48, riskLevel: 'safe' },
  { id: 'lp3', symbol: 'SOL/USDT', exchange: 'bybit', side: 'short', quantity: 40, entryPrice: 195, markPrice: 192, liquidationPrice: 222, leverage: 4, margin: 1950, unrealizedPnl: 120, realizedPnl: 0, marginRatio: 0.44, riskLevel: 'safe' },
  { id: 'lp4', symbol: 'DOGE/USDT', exchange: 'binance', side: 'long', quantity: 30000, entryPrice: 0.092, markPrice: 0.078, liquidationPrice: 0.069, leverage: 8, margin: 345, unrealizedPnl: -420, realizedPnl: 0, marginRatio: 0.82, riskLevel: 'danger' },
];

const ORDERS: Order[] = [
  { id: 'lo1', symbol: 'BTC/USDT', exchange: 'binance', side: 'buy', type: 'limit', price: 44000, quantity: 0.1, filledQuantity: 0, status: 'submitted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'lo2', symbol: 'ETH/USDT', exchange: 'binance', side: 'sell', type: 'take_profit', price: 3500, quantity: 4, filledQuantity: 0, status: 'submitted', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'lo3', symbol: 'SOL/USDT', exchange: 'bybit', side: 'buy', type: 'limit', price: 185, quantity: 20, filledQuantity: 10, status: 'partial_filled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const TRADES: Trade[] = [
  { id: 'lt1', orderId: 'lo0', symbol: 'BTC/USDT', exchange: 'binance', side: 'buy', price: 45200, quantity: 0.3, fee: 13.56, feeCurrency: 'USDT', realizedPnl: 0, time: '2026-06-07T09:00:00Z' },
  { id: 'lt2', orderId: 'lo0', symbol: 'ETH/USDT', exchange: 'binance', side: 'sell', price: 3280, quantity: 5, fee: 16.4, feeCurrency: 'USDT', realizedPnl: 400, time: '2026-06-07T08:30:00Z' },
  { id: 'lt3', orderId: 'lo0', symbol: 'SOL/USDT', exchange: 'bybit', side: 'sell', price: 198, quantity: 20, fee: 7.92, feeCurrency: 'USDT', realizedPnl: 60, time: '2026-06-07T07:15:00Z' },
  { id: 'lt4', orderId: 'lo0', symbol: 'BTC/USDT', exchange: 'binance', side: 'sell', price: 47000, quantity: 0.15, fee: 7.05, feeCurrency: 'USDT', realizedPnl: 270, time: '2026-06-06T22:45:00Z' },
  { id: 'lt5', orderId: 'lo0', symbol: 'DOGE/USDT', exchange: 'binance', side: 'buy', price: 0.092, quantity: 30000, fee: 2.76, feeCurrency: 'USDT', realizedPnl: 0, time: '2026-06-06T18:20:00Z' },
];

const EQUITY_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  value: Math.round((50000 + Math.sin(i / 4) * 3000 + i * 220) * 100) / 100,
}));

export default function TradeAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, [accountId]);

  const dangerPositions = POSITIONS.filter((p) => p.riskLevel === 'danger');

  const posCols: ColumnsType<Position> = [
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 60, render: (v: string) => <Tag color={v === 'long' ? 'green' : 'red'}>{v === 'long' ? '多' : '空'}</Tag> },
    { title: '数量', dataIndex: 'quantity' },
    { title: '开仓价', dataIndex: 'entryPrice', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '标记价', dataIndex: 'markPrice', render: (v: number) => `$${v.toLocaleString()}` },
    {
      title: '强平价', dataIndex: 'liquidationPrice', render: (v: number, r: Position) => {
        const dist = r.side === 'long' ? ((r.markPrice - v) / r.markPrice * 100) : ((v - r.markPrice) / r.markPrice * 100);
        return <span style={{ color: dist < 10 ? 'var(--red-trade)' : 'var(--text-primary)', fontFamily: 'monospace' }}>${v.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>({dist.toFixed(1)}%)</span></span>;
      },
    },
    { title: '杠杆', dataIndex: 'leverage', render: (v: number) => `${v}x` },
    { title: '未实现盈亏', dataIndex: 'unrealizedPnl', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600, fontFamily: 'monospace' }}>{v >= 0 ? '+' : ''}${v.toFixed(2)}</span> },
    { title: '保证金率', dataIndex: 'marginRatio', render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" strokeColor={v > 0.7 ? '#EF5350' : v > 0.4 ? '#FF9800' : '#26A69A'} /> },
    { title: '风险', dataIndex: 'riskLevel', width: 70, render: (v: string) => <Tag color={v === 'danger' ? 'red' : v === 'warning' ? 'orange' : 'green'}>{v === 'danger' ? '高危' : v === 'warning' ? '警告' : '安全'}</Tag> },
    {
      title: '操作', width: 100, render: (_: unknown, r: Position) => (
        <Space size="small">
          <Button size="small" danger onClick={() => { setSelectedPos(r); setCloseModalOpen(true); }}>平仓</Button>
        </Space>
      ),
    },
  ];

  const ordCols: ColumnsType<Order> = [
    { title: '交易对', dataIndex: 'symbol' },
    { title: '方向', dataIndex: 'side', render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买' : '卖'}</Tag> },
    { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v === 'limit' ? '限价' : v === 'market' ? '市价' : v === 'take_profit' ? '止盈' : '止损'}</Tag> },
    { title: '价格', dataIndex: 'price', render: (v?: number) => v ? `$${v.toLocaleString()}` : '市价' },
    { title: '数量', dataIndex: 'quantity' },
    { title: '已成交', dataIndex: 'filledQuantity' },
    {
      title: '状态', dataIndex: 'status', render: (v: string) => (
        <StatusTag status={v} statusMap={{ submitted: { label: '已提交', color: 'processing' }, partial_filled: { label: '部分成交', color: 'blue' }, filled: { label: '全部成交', color: 'success' }, cancelled: { label: '已撤销', color: 'warning' } } as Record<string, { label: string; color: string }>} />
      ),
    },
    { title: '操作', width: 60, render: () => <Button size="small" danger type="link">撤单</Button> },
  ];

  const tradeCols: ColumnsType<Trade> = [
    { title: '时间', dataIndex: 'time', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 60, render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买' : '卖'}</Tag> },
    { title: '价格', dataIndex: 'price', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '数量', dataIndex: 'quantity' },
    { title: '手续费', dataIndex: 'fee', render: (v: number, r: Trade) => `${v} ${r.feeCurrency}` },
    { title: '已实现盈亏', dataIndex: 'realizedPnl', render: (v: number) => <span style={{ color: v > 0 ? 'var(--green-trade)' : v < 0 ? 'var(--red-trade)' : 'var(--text-secondary)', fontFamily: 'monospace' }}>{v > 0 ? '+' : ''}${v.toFixed(2)}</span> },
  ];

  if (loading) {
    return (
      <div>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>实盘账户详情</Typography.Title>
        <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div></Card>
      </div>
    );
  }

  return (
    <div>
      {/* 危险持仓预警 */}
      {dangerPositions.length > 0 && (
        <Alert type="error" banner showIcon icon={<WarningOutlined />}
          message={<span>⚠️ <strong>强平预警</strong> — {dangerPositions.map((p) => `${p.symbol} 保证金率 ${(p.marginRatio * 100).toFixed(0)}%`).join('；')}。请尽快处理。</span>}
          style={{ marginBottom: 16, border: '2px solid var(--red-trade)', borderRadius: 6 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>{ACCOUNT.name}</Typography.Title>
          <Tag color="red">实盘</Tag>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{EXCHANGE_MAP[ACCOUNT.exchange]}</span>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('下单功能请前往实盘交易页面')}>新建订单</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><StatCard title="当前净值" value={ACCOUNT.currentEquity} format="usdt" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="总收益率" value={ACCOUNT.totalReturnPercent} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="今日盈亏" value={ACCOUNT.todayPnl} format="usdt" trend={ACCOUNT.todayPnl >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="可用保证金" value={ACCOUNT.availableMargin} format="usdt" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="已用保证金" value={ACCOUNT.usedMargin} format="usdt" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="活跃策略" value={ACCOUNT.activeStrategies} format="number" /></Col>
      </Row>

      {/* 净值曲线 */}
      <Card title="净值曲线" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <BaseChart type="line" data={EQUITY_DATA} xField="date" yField="value" height={280} />
      </Card>

      {/* 已绑定策略 + 风险指标 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="已绑定策略" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Space wrap>
              <Tag closable color="blue">EMA金叉策略 (实盘)</Tag>
              <Tag closable color="blue">布林带突破 (实盘)</Tag>
              <Tag closable color="blue">多因子选币 (实盘)</Tag>
              <Button type="dashed" icon={<LinkOutlined />} size="small" onClick={() => message.info('绑定策略功能将在后续实现')}>绑定策略</Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="风险指标" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Row gutter={[16, 8]}>
              <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>保证金使用率</div><div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>{(ACCOUNT.usedMargin / (ACCOUNT.usedMargin + ACCOUNT.availableMargin) * 100).toFixed(1)}%</div></Col>
              <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>风险敞口</div><div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>${ACCOUNT.usedMargin.toLocaleString()}</div></Col>
              <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>风险等级</div>
                {(() => {
                  const ratio = ACCOUNT.usedMargin / (ACCOUNT.usedMargin + ACCOUNT.availableMargin);
                  const lvl = ratio > 0.7 ? 'danger' : ratio > 0.4 ? 'warning' : 'safe';
                  return <Tag color={RISK_LEVEL_MAP[lvl]?.color}>{RISK_LEVEL_MAP[lvl]?.label}</Tag>;
                })()}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Tab: 持仓/挂单/成交 */}
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Tabs defaultActiveKey="positions" items={[
          { key: 'positions', label: `持仓 (${POSITIONS.length})`, children: <Table columns={posCols} dataSource={POSITIONS} rowKey="id" pagination={false} size="middle" scroll={{ x: 1100 }} /> },
          { key: 'orders', label: `挂单 (${ORDERS.length})`, children: <Table columns={ordCols} dataSource={ORDERS} rowKey="id" pagination={false} size="middle" /> },
          { key: 'trades', label: `成交历史 (${TRADES.length})`, children: <Table columns={tradeCols} dataSource={TRADES} rowKey="id" pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 笔` }} size="middle" /> },
        ]} />
      </Card>

      {/* 平仓确认 */}
      <ConfirmModal
        open={closeModalOpen}
        title="确认平仓"
        content={selectedPos ? `将以市价平仓 ${selectedPos.quantity} ${selectedPos.symbol}（${selectedPos.side === 'long' ? '多头' : '空头'}）` : ''}
        danger
        confirmText="确认平仓"
        onConfirm={() => { message.success(`${selectedPos?.symbol} 平仓指令已提交`); setCloseModalOpen(false); }}
        onCancel={() => setCloseModalOpen(false)}
      />
    </div>
  );
}
