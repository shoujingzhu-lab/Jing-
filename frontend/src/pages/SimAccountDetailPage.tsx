import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Tabs, Tag, Space, Select, message } from 'antd';
import { PlusOutlined, ReloadOutlined, LinkOutlined, StopOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { simApi, tradingApi } from '@/lib/api';
import { EXCHANGE_MAP } from '@/lib/constants';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import BaseChart from '@/components/Chart/BaseChart';
import type { TradingAccount, Position, Order, Trade } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function SimAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    const load = async () => {
      try {
        const [accRes, tradesRes] = await Promise.allSettled([
          simApi.getAccount(accountId),
          simApi.getTrades(accountId, { page_size: 50 }),
        ]);

        if (accRes.status === 'fulfilled') {
          const a = (accRes.value.data as unknown as { data: TradingAccount })?.data
            || (accRes.value.data as unknown as TradingAccount);
          setAccount(a as TradingAccount);
        }

        if (tradesRes.status === 'fulfilled') {
          const t = (tradesRes.value.data as unknown as { items?: Trade[] })?.items
            || (tradesRes.value.data as unknown as Trade[]) || [];
          setTrades(Array.isArray(t) ? t : []);
        }

        // 获取持仓和订单
        try {
          const posRes = await tradingApi.getPositions();
          const posData = (posRes.data as unknown as { data: Position[] })?.data
            || (posRes.data as unknown as Position[]) || [];
          setPositions(Array.isArray(posData) ? posData : []);
        } catch { /* 持仓可能为空 */ }

        try {
          const ordRes = await tradingApi.getOrders({ page_size: 20 });
          const ordData = (ordRes.data as unknown as { items?: Order[] })?.items
            || (ordRes.data as unknown as Order[]) || [];
          setOrders(Array.isArray(ordData) ? ordData : []);
        } catch { /* 订单可能为空 */ }
      } catch {
        message.error('加载账户数据失败');
      } finally {
        setLoading(false);
      }
    };
    load();
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
    { title: '开仓价', dataIndex: 'entryPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '标记价', dataIndex: 'markPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '强平价', dataIndex: 'liquidationPrice', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '杠杆', dataIndex: 'leverage', render: (v: number) => `${v ?? 0}x` },
    { title: '未实现盈亏', dataIndex: 'unrealizedPnl', render: (v: number) => <span style={{ color: (v ?? 0) >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>${(v ?? 0).toFixed(2)}</span> },
    { title: '保证金率', dataIndex: 'marginRatio', render: (v: number) => <span style={{ color: v > 0.7 ? 'var(--red-trade)' : v > 0.4 ? '#FF9800' : 'var(--green-trade)' }}>{((v ?? 0) * 100).toFixed(1)}%</span> },
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
    { title: '价格', dataIndex: 'price', render: (v: number) => `$${(v ?? 0).toLocaleString()}` },
    { title: '数量', dataIndex: 'quantity' },
    { title: '手续费', dataIndex: 'fee', render: (v: number, r: Trade) => `${v ?? 0} ${r.feeCurrency ?? 'USDT'}` },
    { title: '时间', dataIndex: 'time', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '--' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>{account?.name || '模拟账户'}</Typography.Title>
          <Tag color="blue">模拟</Tag>
          {account?.exchange && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{EXCHANGE_MAP[account.exchange] || account.exchange}</span>}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('下单功能将在后续实现')}>新建订单</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}><StatCard title="当前净值" value={account?.currentEquity ?? 0} format="usdt" trend="up" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="总收益率" value={account?.totalReturnPercent ?? 0} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="今日盈亏" value={account?.todayPnl ?? 0} format="usdt" trend={(account?.todayPnl ?? 0) >= 0 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="可用保证金" value={account?.availableMargin ?? 0} format="usdt" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="已用保证金" value={account?.usedMargin ?? 0} format="usdt" /></Col>
        <Col xs={12} sm={8} lg={4}><StatCard title="活跃策略" value={account?.activeStrategies ?? 0} format="number" /></Col>
      </Row>

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Tabs defaultActiveKey="positions" items={[
          { key: 'positions', label: `持仓 (${positions.length})`, children: <Table columns={posCols} dataSource={positions} rowKey="id" pagination={false} size="middle" scroll={{ x: 1000 }} /> },
          { key: 'orders', label: `挂单 (${orders.length})`, children: <Table columns={ordCols} dataSource={orders} rowKey="id" pagination={false} size="middle" /> },
          { key: 'trades', label: `成交 (${trades.length})`, children: <Table columns={tradeCols} dataSource={trades} rowKey="id" pagination={false} size="middle" /> },
        ]} />
      </Card>
    </div>
  );
}
