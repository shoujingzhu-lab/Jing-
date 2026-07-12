import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col } from 'antd';
import { CaretUpOutlined, CaretDownOutlined } from '@ant-design/icons';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
import PriceDisplay from '@/components/ui/PriceDisplay';
import { getChangeColor } from '@/lib/utils/format';
import type { Ticker } from '@/lib/types';

interface Props {
  data?: Ticker[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/** 迷你 K 线嵌入卡片 */
function MiniKlineSparkline({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const isUp = data[data.length - 1] >= data[0];
    ctx.strokeStyle = isUp ? '#26A69A' : '#EF5350';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((val - min) / range) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} width={80} height={32} style={{ display: 'block' }} />;
}

export default function MarketSnapshot({ data, loading, error, onRetry }: Props) {
  const navigate = useNavigate();

  if (error) return <ErrorBoundaryCard error={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Skeleton type="card" />
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>关注交易对行情</span>
        <a style={{ fontSize: 12, color: 'var(--brand)' }} onClick={() => navigate('/market')}>
          查看全部 →
        </a>
      </div>
      <Row gutter={[12, 12]}>
        {(data || []).slice(0, 6).map((ticker) => {
          const isUp = ticker.changePercent24h >= 0;
          const sparkData = generateSparkData(ticker.lastPrice, ticker.changePercent24h);

          return (
            <Col xs={24} sm={12} md={8} lg={4} key={ticker.symbol}>
              <Card
                hoverable
                size="small"
                onClick={() => navigate(`/market/${ticker.symbol}`)}
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  cursor: 'pointer',
                }}
                styles={{ body: { padding: '12px 14px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ticker.symbol}
                    </div>
                    <PriceDisplay price={ticker.lastPrice} decimals={ticker.lastPrice < 1 ? 4 : 2} />
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: getChangeColor(ticker.changePercent24h),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
                      {ticker.changePercent24h > 0 ? '+' : ''}{ticker.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                  <MiniKlineSparkline data={sparkData} />
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

function generateSparkData(lastPrice: number, _changePercent: number) {
  const length = 20;
  const volatility = lastPrice * 0.0005;
  const data: number[] = [];
  let price = lastPrice * 0.99;

  for (let i = 0; i < length; i++) {
    price += (Math.random() - 0.48) * volatility * 2;
    data.push(Math.round(price * 100) / 100);
  }
  return data;
}
