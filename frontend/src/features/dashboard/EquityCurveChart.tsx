import { useMemo, useState } from 'react';
import { Card, Radio, Space } from 'antd';
import BaseChart from '@/components/Chart/BaseChart';
import Skeleton from '@/components/ui/Skeleton';
import { ErrorBoundaryCard } from '@/components/ui/ErrorBoundary';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartOption = any;

type Period = '1D' | '1W' | '1M' | '3M' | 'ALL';

interface Props {
  data?: { time: string; equity: number; drawdown: number }[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function EquityCurveChart({ data, loading, error, onRetry }: Props) {
  const [period, setPeriod] = useState<Period>('3M');

  const option: ChartOption = useMemo(() => {
    if (!data?.length) return {};

    const filtered = filterByPeriod(data, period);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['净值', '回撤'],
        top: 0,
        textStyle: { color: '#8B949E', fontSize: 12 },
      },
      grid: [
        { left: '3%', right: '4%', top: 40, height: '55%' },
        { left: '3%', right: '4%', top: '72%', height: '20%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: filtered.map((d) => d.time),
          axisLine: { lineStyle: { color: '#30363D' } },
          axisLabel: { color: '#8B949E', fontSize: 10 },
          gridIndex: 0,
        },
        {
          type: 'category',
          data: filtered.map((d) => d.time),
          axisLine: { lineStyle: { color: '#30363D' } },
          axisLabel: { show: false },
          gridIndex: 1,
        },
      ],
      yAxis: [
        {
          type: 'value',
          name: '净值 (USDT)',
          nameTextStyle: { color: '#8B949E', fontSize: 10 },
          axisLabel: { color: '#8B949E', fontSize: 10, formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
          splitLine: { lineStyle: { color: '#21262D' } },
          gridIndex: 0,
        },
        {
          type: 'value',
          name: '回撤 %',
          nameTextStyle: { color: '#8B949E', fontSize: 10 },
          axisLabel: { color: '#8B949E', fontSize: 10, formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: '#21262D' } },
          gridIndex: 1,
          inverse: true,
        },
      ],
      series: [
        {
          name: '净值',
          type: 'line',
          data: filtered.map((d) => d.equity),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#F0B90B', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(240,185,11,0.3)' },
                { offset: 1, color: 'rgba(240,185,11,0.02)' },
              ],
            },
          },
          markLine: data?.length ? {
            silent: true,
            data: [{ type: 'average', name: '均价' }],
            lineStyle: { color: '#8B949E', type: 'dashed' },
          } : undefined,
        },
        {
          name: '回撤',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: filtered.map((d) => -d.drawdown),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#EF5350', width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239,83,80,0.4)' },
                { offset: 1, color: 'rgba(239,83,80,0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [data, period]);

  if (error) return <ErrorBoundaryCard error={error} onRetry={onRetry} />;
  if (loading) return <Skeleton type="chart" />;

  return (
    <Card
      title="资产净值曲线"
      extra={
        <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} size="small">
          <Radio.Button value="1D">1D</Radio.Button>
          <Radio.Button value="1W">1W</Radio.Button>
          <Radio.Button value="1M">1M</Radio.Button>
          <Radio.Button value="3M">3M</Radio.Button>
          <Radio.Button value="ALL">ALL</Radio.Button>
        </Radio.Group>
      }
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <BaseChart option={option} height={360} />
    </Card>
  );
}

function filterByPeriod(data: { time: string; equity: number; drawdown: number }[], period: Period) {
  const periods: Record<Period, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, 'ALL': 0 };
  const days = periods[period];
  if (!days) return data;
  return data.slice(-days);
}
