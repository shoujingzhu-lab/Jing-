import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Input, Select, Space, Table, Tag, Button } from 'antd';
import { StarOutlined, StarFilled, SearchOutlined, CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import { useMarketOverview } from '@/hooks/useMarketData';
import { useMarketStore } from '@/stores/marketStore';
import { EXCHANGES } from '@/lib/constants';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
import PriceDisplay from '@/components/ui/PriceDisplay';
import { formatNumber } from '@/lib/utils/format';
import type { Ticker, Exchange } from '@/lib/types';

export default function MarketPage() {
  const navigate = useNavigate();
  const { tickers, loading, error, refresh } = useMarketOverview();
  const { watchlist, addToWatchlist, removeFromWatchlist, isWatched } = useMarketStore();

  const [search, setSearch] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<Exchange[]>([]);
  const [sortBy, setSortBy] = useState<string>('volume24h');
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  const filteredTickers = useMemo(() => {
    let result = [...tickers];
    if (search) result = result.filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()));
    if (exchangeFilter.length > 0) result = result.filter((t) => exchangeFilter.includes(t.exchange));
    if (showWatchlistOnly) result = result.filter((t) => watchlist.includes(t.symbol));
    result.sort((a, b) => {
      const key = sortBy as keyof Ticker;
      return (b[key] as number) - (a[key] as number);
    });
    return result;
  }, [tickers, search, exchangeFilter, showWatchlistOnly, sortBy, watchlist]);

  const gainers = useMemo(() => [...tickers].sort((a, b) => b.changePercent24h - a.changePercent24h).slice(0, 5), [tickers]);
  const losers = useMemo(() => [...tickers].sort((a, b) => a.changePercent24h - b.changePercent24h).slice(0, 5), [tickers]);

  if (error) return <ErrorBoundaryCard error={error} onRetry={refresh} />;

  const columns = [
    {
      title: '', key: 'star', width: 36,
      render: (_: unknown, record: Ticker) => (
        <span onClick={(e) => { e.stopPropagation(); isWatched(record.symbol) ? removeFromWatchlist(record.symbol) : addToWatchlist(record.symbol); }}
          style={{ cursor: 'pointer', color: isWatched(record.symbol) ? '#F0B90B' : 'var(--text-secondary)' }}>
          {isWatched(record.symbol) ? <StarFilled /> : <StarOutlined />}
        </span>
      ),
    },
    {
      title: '交易对', dataIndex: 'symbol', key: 'symbol', width: 130,
      render: (text: string) => <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{text}</span>,
    },
    {
      title: '最新价', dataIndex: 'lastPrice', key: 'lastPrice', width: 120, align: 'right' as const,
      render: (price: number) => <PriceDisplay price={price} decimals={price < 1 ? 4 : 2} prefix="$" />,
    },
    {
      title: '24h 涨跌', dataIndex: 'changePercent24h', key: 'changePercent24h', width: 110, align: 'right' as const,
      render: (val: number) => {
        const isUp = val >= 0;
        return <span style={{ color: isUp ? 'var(--green-trade)' : 'var(--red-trade)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
          {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}{isUp ? '+' : ''}{val.toFixed(2)}%
        </span>;
      },
    },
    {
      title: '24h 高', dataIndex: 'high24h', key: 'high24h', width: 110, align: 'right' as const,
      render: (v: number) => <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${formatNumber(v)}</span>,
    },
    {
      title: '24h 低', dataIndex: 'low24h', key: 'low24h', width: 110, align: 'right' as const,
      render: (v: number) => <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${formatNumber(v)}</span>,
    },
    {
      title: '24h 成交量', dataIndex: 'volume24h', key: 'volume24h', width: 120, align: 'right' as const,
      render: (v: number) => <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatNumber(v)}</span>,
    },
    {
      title: '交易所', dataIndex: 'exchange', key: 'exchange', width: 80,
      render: (ex: string) => <Tag color="default">{ex.toUpperCase()}</Tag>,
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>行情中心</Typography.Title>

      {/* Mini Ticker Bar */}
      <div style={{ overflow: 'hidden', padding: '8px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 16 }}>
        <style>{`@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
        <div style={{ display: 'inline-flex', gap: 24, animation: 'scroll 40s linear infinite', whiteSpace: 'nowrap' }}>
          {[...tickers.slice(0, 15), ...tickers.slice(0, 15)].map((t, i) => (
            <span key={`${t.symbol}-${i}`} style={{ cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}
              onClick={() => navigate(`/market/${t.symbol}`)}>
              <span style={{ color: 'var(--text-primary)' }}>{t.symbol}</span>{' '}
              <span style={{ color: t.changePercent24h >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>
                ${t.lastPrice.toLocaleString()} {t.changePercent24h >= 0 ? '+' : ''}{t.changePercent24h.toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="搜索交易对..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} allowClear />
        <Select mode="multiple" placeholder="交易所" value={exchangeFilter} onChange={setExchangeFilter}
          style={{ minWidth: 150 }} maxTagCount={2}
          options={EXCHANGES.map((e) => ({ value: e.key, label: `${e.icon} ${e.label}` }))} />
        <Select placeholder="排序" value={sortBy} onChange={setSortBy} style={{ width: 130 }}
          options={[{ value: 'volume24h', label: '成交量' }, { value: 'changePercent24h', label: '涨跌幅' }, { value: 'lastPrice', label: '最新价' }]} />
        <Button type={showWatchlistOnly ? 'primary' : 'default'} onClick={() => setShowWatchlistOnly(!showWatchlistOnly)} icon={<StarFilled />}>自选</Button>
      </Space>

      {/* Table + Sidebar */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? <Skeleton type="table" rows={12} /> : (
            <Table<Ticker> dataSource={filteredTickers} columns={columns} rowKey="symbol" size="small"
              pagination={false} scroll={{ y: 600 }} virtual
              onRow={(record) => ({ onClick: () => navigate(`/market/${record.symbol}`), style: { cursor: 'pointer' } })}
              style={{ background: 'var(--bg-secondary)' }} />
          )}
        </div>
        {/* Hot Lists */}
        <div style={{ width: 220, flexShrink: 0 }}>
          {[
            { title: '🔥 涨幅榜', color: 'var(--green-trade)', data: gainers },
            { title: '📉 跌幅榜', color: 'var(--red-trade)', data: losers },
          ].map((section) => (
            <div key={section.title} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Typography.Text strong style={{ color: section.color, fontSize: 13, display: 'block', marginBottom: 8 }}>{section.title}</Typography.Text>
              {section.data.map((t) => (
                <div key={t.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => navigate(`/market/${t.symbol}`)}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{t.symbol}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: section.color }}>
                    {section.title.includes('涨') ? '+' : ''}{t.changePercent24h.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
