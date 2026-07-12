import { useRef, useEffect, useState } from 'react';
import { Radio, Space, Typography } from 'antd';
import type { Kline, KlinePeriod } from '@/lib/types';

interface Props {
  data: Kline[];
  loading?: boolean;
  symbol: string;
}

export default function KlineChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<KlinePeriod>('1h');

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const drawChart = async () => {
      // 动态导入 lightweight-charts (仅客户端)
      try {
        const { createChart, ColorType } = await import('lightweight-charts');
        containerRef.current!.innerHTML = '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chart: any = createChart(containerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: '#161B22' },
            textColor: '#8B949E',
          },
          grid: {
            vertLines: { color: '#21262D' },
            horzLines: { color: '#21262D' },
          },
          crosshair: { mode: 0 },
          timeScale: { borderColor: '#30363D', timeVisible: true },
          rightPriceScale: { borderColor: '#30363D' },
          width: containerRef.current!.clientWidth,
          height: containerRef.current!.clientHeight,
        });

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#26A69A',
          downColor: '#EF5350',
          borderUpColor: '#26A69A',
          borderDownColor: '#EF5350',
          wickUpColor: '#26A69A',
          wickDownColor: '#EF5350',
        });

        const chartData = data.map((k) => ({
          time: (k.openTime / 1000) as import('lightweight-charts').UTCTimestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));

        candleSeries.setData(chartData);

        // 成交量
        const volumeSeries = chart.addHistogramSeries({
          color: '#26A69A',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(
          data.map((k) => ({
            time: (k.openTime / 1000) as import('lightweight-charts').UTCTimestamp,
            value: k.volume,
            color: k.close >= k.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
          }))
        );

        // 响应式
        const handleResize = () => {
          if (containerRef.current) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
      } catch {
        containerRef.current!.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary)">📊 K线图组件加载中...</div>';
      }
    };

    drawChart();
  }, [data, period]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          K线图
        </Typography.Text>
        <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} size="small">
          <Radio.Button value="1m">1m</Radio.Button>
          <Radio.Button value="5m">5m</Radio.Button>
          <Radio.Button value="15m">15m</Radio.Button>
          <Radio.Button value="1h">1h</Radio.Button>
          <Radio.Button value="4h">4h</Radio.Button>
          <Radio.Button value="1d">1d</Radio.Button>
          <Radio.Button value="1w">1w</Radio.Button>
        </Radio.Group>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 450, borderRadius: 6, overflow: 'hidden' }} />
    </div>
  );
}
