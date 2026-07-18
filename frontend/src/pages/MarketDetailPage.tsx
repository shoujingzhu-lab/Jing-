import { useParams } from 'react-router-dom';
import { Row, Col, Card, Typography, Tag, Button, InputNumber, Select, Tabs } from 'antd';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import { useSymbolDetail } from '@/hooks/useMarketData';
import KlineChart from '@/features/market/KlineChart';
import Skeleton from '@/components/ui/Skeleton';
import BaseChart from '@/components/Chart/BaseChart';
import { formatRelativeTime, formatCryptoAmount } from '@/lib/utils/format';

export default function MarketDetailPage() {
  const { symbol = 'BTC/USDT' } = useParams();
  const { klines, orderBook, trades, ticker, loading } = useSymbolDetail(symbol);

  // 从真实 ticker 中取数据，加载中用估计值
  const lastPrice = ticker?.lastPrice;
  const changePercent = ticker?.changePercent24h ?? 0;
  const high24h = ticker?.high24h ?? lastPrice;
  const low24h = ticker?.low24h ?? lastPrice;
  const volume24h = ticker?.volume24h ?? 0;

  // 订单簿深度图
  const maxBidAmount = orderBook ? Math.max(...orderBook.bids.map((b) => b.amount), 1) : 1;
  const maxAskAmount = orderBook ? Math.max(...orderBook.asks.map((a) => a.amount), 1) : 1;

  const depthOption = {
    xAxis: { type: 'value' as const, axisLabel: { fontSize: 10, color: '#8B949E' } },
    yAxis: { type: 'value' as const, axisLabel: { fontSize: 10, color: '#8B949E' } },
    series: [
      {
        type: 'line' as const,
        data: orderBook?.bids.map((b, i) => [b.price, orderBook.bids.slice(0, i + 1).reduce((s, x) => s + x.amount, 0)]) || [],
        smooth: true, step: 'end' as const,
        lineStyle: { color: '#26A69A', width: 2 },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(38,166,154,0.4)' }, { offset: 1, color: 'rgba(38,166,154,0.05)' }] } },
      },
      {
        type: 'line' as const,
        data: orderBook?.asks.map((a, i) => [a.price, orderBook.asks.slice(0, i + 1).reduce((s, x) => s + x.amount, 0)]) || [],
        smooth: true, step: 'start' as const,
        lineStyle: { color: '#EF5350', width: 2 },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,83,80,0.05)' }, { offset: 1, color: 'rgba(239,83,80,0.4)' }] } },
      },
    ],
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
            {symbol}
          </Typography.Title>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
              {loading ? '--' : lastPrice ? `$${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
            </span>
            <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: changePercent >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>
              {changePercent >= 0 ? <CaretUpOutlined /> : <CaretDownOutlined />}
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
            <Tag>24h</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, color: 'var(--text-secondary)', fontSize: 12 }}>
          <div>24h高 <span style={{ color: 'var(--text-primary)' }}>{high24h ? `$${high24h.toLocaleString()}` : '--'}</span></div>
          <div>24h低 <span style={{ color: 'var(--text-primary)' }}>{low24h ? `$${low24h.toLocaleString()}` : '--'}</span></div>
          <div>24h量 <span style={{ color: 'var(--text-primary)' }}>{volume24h ? volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '--'}</span></div>
        </div>
      </div>

      {/* K线 + 订单簿 + 交易 */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} styles={{ body: { padding: 12 } }}>
            {loading ? <Skeleton type="chart" /> : (
              klines.length > 0 ? (
                <KlineChart data={klines} loading={loading} symbol={symbol} />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  📊 K线数据加载中，请确认所选交易对在 OKX/GateIO 上有数据
                </div>
              )
            )}
          </Card>
          <Card title="订单簿深度图" size="small" style={{ marginTop: 8, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {orderBook ? <BaseChart option={depthOption} height={150} /> : <Skeleton type="chart" />}
          </Card>
        </Col>

        {/* 订单簿 */}
        <Col xs={24} lg={5}>
          <Card title="订单簿" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 8 }}
            styles={{ body: { padding: '4px 8px', fontSize: 12 } }}>
            {orderBook ? (
              <>
                {orderBook.asks.slice(0, 10).reverse().map((a, i) => (
                  <div key={`a${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'var(--red-bg)', width: `${(a.amount / maxAskAmount) * 100}%`, zIndex: 0 }} />
                    <span style={{ color: 'var(--red-trade)', zIndex: 1, fontFamily: "'JetBrains Mono', monospace" }}>${a.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span style={{ color: 'var(--text-secondary)', zIndex: 1, fontFamily: "'JetBrains Mono', monospace" }}>{formatCryptoAmount(a.amount)}</span>
                  </div>
                ))}
                <div style={{ textAlign: 'center', padding: '6px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {lastPrice ? `$${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '--'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 8 }}>
                    价差 ${((orderBook.asks[0]?.price || 0) - (orderBook.bids[0]?.price || 0)).toFixed(2)}
                  </span>
                </div>
                {orderBook.bids.slice(0, 10).map((b, i) => (
                  <div key={`b${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'var(--green-bg)', width: `${(b.amount / maxBidAmount) * 100}%`, zIndex: 0 }} />
                    <span style={{ color: 'var(--green-trade)', zIndex: 1, fontFamily: "'JetBrains Mono', monospace" }}>${b.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span style={{ color: 'var(--text-secondary)', zIndex: 1, fontFamily: "'JetBrains Mono', monospace" }}>{formatCryptoAmount(b.amount)}</span>
                  </div>
                ))}
              </>
            ) : loading ? <Skeleton type="list" /> : <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无订单簿数据</div>}
          </Card>
          {/* 最新成交 */}
          <Card title="最新成交" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            styles={{ body: { padding: '4px 8px', maxHeight: 260, overflow: 'auto' } }}>
            {trades.length > 0 ? (
              trades.slice(0, 15).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  <span style={{ color: t.side === 'buy' ? 'var(--green-trade)' : 'var(--red-trade)' }}>{t.price.toLocaleString()}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatCryptoAmount(t.amount)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{formatRelativeTime(t.timestamp)}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>暂无成交记录</div>
            )}
          </Card>
        </Col>

        {/* 快速交易面板 */}
        <Col xs={24} lg={3}>
          <Card title="快速交易" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            styles={{ body: { padding: 12 } }}>
            <Tabs size="small" items={[{
              key: 'spot', label: '现货', children: (
                <div>
                  <Select defaultValue="limit" size="small" style={{ width: '100%', marginBottom: 8 }}
                    options={[{ value: 'limit', label: '限价' }, { value: 'market', label: '市价' }]} />
                  <InputNumber size="small" placeholder="价格" style={{ width: '100%', marginBottom: 8 }} />
                  <InputNumber size="small" placeholder="数量" style={{ width: '100%', marginBottom: 8 }} />
                  <Select defaultValue="100" size="small" style={{ width: '100%', marginBottom: 12 }}
                    options={[{ value: '25', label: '25%' }, { value: '50', label: '50%' }, { value: '75', label: '75%' }, { value: '100', label: '100%' }]} />
                  <Button type="primary" block style={{ background: 'var(--green-trade)', borderColor: 'var(--green-trade)', marginBottom: 6 }}>买入</Button>
                  <Button type="primary" danger block>卖出</Button>
                </div>
              ),
            }]} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
