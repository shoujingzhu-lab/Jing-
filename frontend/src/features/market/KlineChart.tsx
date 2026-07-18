import { useRef, useEffect, useState } from 'react';
import { Radio, Space, Typography } from 'antd';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { UTCTimestamp } from 'lightweight-charts';
import type { Kline, KlinePeriod } from '@/lib/types';

interface Props {
  data: Kline[];
  loading?: boolean;
  symbol: string;
}

export default function KlineChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  const [period, setPeriod] = useState<KlinePeriod>('1h');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    // 清理旧图表
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ignore */ }
      chartRef.current = null;
    }

    try {
      const container = containerRef.current;
      const width = container.clientWidth || 800;

      const chart = createChart(container, {
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
        width,
        height: 450,
      });

      // v5 API: addSeries(SeriesClass, options)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26A69A',
        downColor: '#EF5350',
        borderUpColor: '#26A69A',
        borderDownColor: '#EF5350',
        wickUpColor: '#26A69A',
        wickDownColor: '#EF5350',
      });

      candleSeries.setData(
        data.map((k) => ({
          time: (k.openTime / 1000) as UTCTimestamp,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))
      );

      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26A69A',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(
        data.map((k) => ({
          time: (k.openTime / 1000) as UTCTimestamp,
          value: k.volume,
          color: k.close >= k.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
        }))
      );

      const handleResize = () => {
        if (container) {
          chart.applyOptions({ width: container.clientWidth || 800 });
        }
      };
      window.addEventListener('resize', handleResize);

      chartRef.current = chart;
      setError(null);

      return () => {
        window.removeEventListener('resize', handleResize);
        try { chart.remove(); } catch { /* ignore */ }
      };
    } catch (e) {
      console.error('KlineChart render error:', e);
      setError(`K线图加载失败: ${(e as Error).message?.slice(0, 50) || '未知错误'}`);
    }
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
      {error ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 450, color: 'var(--text-secondary)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 6 }}>
          ⚠️ {error}
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: 450, borderRadius: 6, overflow: 'hidden' }} />
      )}
    </div>
  );
}
