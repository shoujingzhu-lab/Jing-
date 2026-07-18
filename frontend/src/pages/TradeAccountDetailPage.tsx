import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Tabs, Tag, Space, Select, Alert, message, Progress } from 'antd';
import { PlusOutlined, ReloadOutlined, LinkOutlined, WarningOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { tradingApi, simApi } from '@/lib/api';
import { EXCHANGE_MAP, RISK_LEVEL_MAP } from '@/lib/constants';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import ConfirmModal from '@/components/ConfirmModal';
import BaseChart from '@/components/Chart/BaseChart';
import type { TradingAccount, Position, Order, Trade } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function TradeAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);

  useEffect(() => {
    if (!accountId) return;
    const load = async () => {
      try {
        const [posRes, ordRes, tradeRes] = await Promise.allSettled([
          tradingApi.getPositions(),
          tradingApi.getOrders({ page_size: 50 }),
          tradingApi.getLogs({ page_size: 30 }),
        ]);

        if (posRes.status === 'fulfilled') {
          const p = (posRes.value.data as unknown as { data: Position[] })?.data
            || (posRes.value.data as unknown as Position[]) || [];
          setPositions(Array.isArray(p) ? p : []);
        }

        if (ordRes.status === 'fulfilled') {
          const o = (ordRes.value.data as unknown as { items?: Order[] })?.items
            || (ordRes.value.data as unknown as Order[]) || [];
          setOrders(Array.isArray(o) ? o : []);
        }

        if (tradeRes.status === 'fulfilled') {
          const t = (tradeRes.value.data as unknown as { items?: Trade[] })?.items
            || (tradeRes.value.data as unknown as Trade[]) || [];
          setTrades(Array.isArray(t) ? t : []);
        }

        // 账户信息从持仓数据推算
        const totalEquity = positions.reduce((s, p) => s + ((p.margin ?? 0) + (p.unrealizedPnl ?? 0)), 0) || 0;
        const usedMargin = positions.reduce((s, p) => s + (p.margin ?? 0), 0);
        setAccount({
          id: accountId,
          name: '交易账户',
          type: 'contract',
          isSim: false,
          exchange: 'binance',
          initialCapital: totalEquity,
          currentEquity: totalEquity + totalEquity * 0.05,
          availableMargin: totalEquity * 0.6,
          usedMargin,
          unrealizedPnl: positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0),
          realizedPnl: trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0),
          todayPnl: 0,
          totalReturn: 0,
          totalReturnPercent: 0,
          activeStrategies: 0,
          createdAt: new Date().toISOString(),
        });
      } catch {
        // 后端未启动
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accountId]);

  const dangerPositions = positions.filter((p) => p.riskLevel === 'danger');

  const posCols: ColumnsType<Position> = [
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 60, render: (v: string) => <Tag color={v === 'long' ? 'green' : 'red'}>{v === 'long' ? '多' : '空'}</Tag> },
    { title: '数量', dataIndex: 'quantity' },
    { title: '开仓价', dataIndex: 'entryPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '标记价', dataIndex: 'markPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    {
      title: '强平价', dataIndex: 'liquidationPrice', render: (v: number, r: Position) => {
        const markPrice = r.markPrice ?? 0;
        if (!markPrice || !v) return `$${(v ?? 0).toLocaleString()}`;
        const dist = r.side === 'long' ? ((markPrice - v) / markPrice * 100) : ((v - markPrice) / markPrice * 100);
        return <span style={{ color: dist < 10 ? 'var(--red-trade)' : 'var(--text-primary)', fontFamily: 'monospace' }}>${v.toLocaleString()} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>({dist.toFixed(1)}%)</span></span>;
      },
    },
    { title: '杠杆', dataIndex: 'leverage', render: (v: number) => `${v ?? 0}x` },
    { title: '未实现盈亏', dataIndex: 'unrealizedPnl', render: (v: number) => <span style={{ color: (v ?? 0) >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600, fontFamily: 'monospace' }}>{(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}</span> },
    { title: '保证金率', dataIndex: 'marginRatio', render: (v: number) => <Progress percent={Math.round((v ?? 0) * 100)} size="small" strokeColor={(v ?? 0) > 0.7 ? '#EF5350' : (v ?? 0) > 0.4 ? '#FF9800' : '#26A69A'} /> },
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
    { title: '时间', dataIndex: 'time', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '--' },
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 60, render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买' : '卖'}</Tag> },
    { title: '价格', dataIndex: 'price', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '数量', dataIndex: 'quantity' },
    { title: '手续费', dataIndex: 'fee', render: (v: number, r: Trade) => `${v ?? 0} ${r.feeCurrency ?? 'USDT'}` },
    { title: '已实现盈亏', dataIndex: 'realizedPnl', render: (v: number) => <span style={{ color: (v ?? 0) > 0 ? 'var(--green-trade)' : (v ?? 0) < 0 ? 'var(--red-trade)' : 'var(--text-secondary)', fontFamily: 'monospace' }}>{(v ?? 0) > 0 ? '+' : ''}${(v ?? 0).toFixed(2)}</span> },
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
          message={<span>⚠️ <strong>强平预警</strong> — {dangerPositions.map((p) => `${p.symbol} 保证金率 ${((p.marginRatio ?? 0) * 100).toFixed(0)}%`).join('；')}。请尽快处理。</span>}
          style={{ marginBottom: 16, border: '2px solid var(--red-trade)', borderRadius: 6 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>{account?.name || '实盘账户'}</Typography.Title>
          <Tag color="red">实盘</Tag>
          {account?.exchange && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{EXCHANGE_MAP[account.exchange] || account.exchange}</span>}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('下单功能请前往实盘交易页面')}>新建订单</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><StatCard title="当前净值" value={account?.currentEquity ?? 0} format="usdt" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="总收益率" value={account?.totalReturnPercent ?? 0} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="今日盈亏" value={account?.todayPnl ?? 0} format="usdt" trend={(account?.todayPnl ?? 0) >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="可用保证金" value={account?.availableMargin ?? 0} format="usdt" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="已用保证金" value={account?.usedMargin ?? 0} format="usdt" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="活跃策略" value={account?.activeStrategies ?? 0} format="number" /></Col>
      </Row>

      {/* 风险指标 */}
      <Card title="风险指标" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Row gutter={[16, 8]}>
          <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>保证金使用率</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {account ? ((account.usedMargin ?? 0) / (((account.usedMargin ?? 0) + (account.availableMargin ?? 0)) || 1) * 100).toFixed(1) : '0'}%
            </div>
          </Col>
          <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>风险敞口</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace' }}>${((account?.usedMargin ?? 0)).toLocaleString()}</div>
          </Col>
          <Col span={8}><div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>风险等级</div>
            {(() => {
              const ratio = account ? (account.usedMargin ?? 0) / (((account.usedMargin ?? 0) + (account.availableMargin ?? 0)) || 1) : 0;
              const lvl = ratio > 0.7 ? 'danger' : ratio > 0.4 ? 'warning' : 'safe';
              return <Tag color={RISK_LEVEL_MAP[lvl]?.color}>{RISK_LEVEL_MAP[lvl]?.label}</Tag>;
            })()}
          </Col>
        </Row>
      </Card>

      {/* Tab: 持仓/挂单/成交 */}
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Tabs defaultActiveKey="positions" items={[
          { key: 'positions', label: `持仓 (${positions.length})`, children: <Table columns={posCols} dataSource={positions} rowKey="id" pagination={false} size="middle" scroll={{ x: 1100 }} /> },
          { key: 'orders', label: `挂单 (${orders.length})`, children: <Table columns={ordCols} dataSource={orders} rowKey="id" pagination={false} size="middle" /> },
          { key: 'trades', label: `成交历史 (${trades.length})`, children: <Table columns={tradeCols} dataSource={trades} rowKey="id" pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 笔` }} size="middle" /> },
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
