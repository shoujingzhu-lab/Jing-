import { useRef, useEffect } from 'react';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  CandlestickChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components';

echarts.use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  CandlestickChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartOption = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChartInstance = any;

interface BaseChartProps {
  option?: ChartOption;
  /** 简化：指定图表类型，配合 data/xField/yField 自动生成 option */
  type?: 'line' | 'bar' | 'pie' | 'scatter' | 'candlestick' | 'radar';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[];
  xField?: string;
  yField?: string;
  height?: number | string;
  width?: number | string;
  loading?: boolean;
  onChartReady?: (chart: ChartInstance) => void;
  style?: React.CSSProperties;
}

/** 暗色主题默认配置 */
const darkDefaults: Partial<ChartOption> = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8B949E' },
  tooltip: {
    backgroundColor: 'rgba(33,38,45,0.95)',
    borderColor: '#30363D',
    textStyle: { color: '#E6EDF3', fontSize: 13 },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '8%',
    containLabel: true,
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildOption(type: string, data: any[], xField: string, yField: string): ChartOption {
  if (type === 'pie') {
    return { series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], data: data.map((d: any) => ({ name: d[xField], value: d[yField] })) }] };
  }
  if (type === 'radar') {
    const dims = Object.keys(data[0] || {}).filter((k: string) => k !== 'name');
    return {
      radar: { indicator: dims.map((d: string) => ({ name: d, max: 100 })) },
      series: [{ type: 'radar', data: data.map((d: any) => ({ name: d.name, value: dims.map((dim: string) => d[dim]) })) }],
    };
  }
  if (type === 'scatter') {
    return {
      xAxis: { type: 'value' as const, name: xField },
      yAxis: { type: 'value' as const, name: yField },
      series: [{ type: 'scatter', data: data.map((d: any) => [d[xField], d[yField]]), symbolSize: 10 }],
    };
  }
  return {
    xAxis: { type: 'category' as const, data: data.map((d: any) => d[xField]) },
    yAxis: { type: 'value' as const },
    series: [{ type, data: data.map((d: any) => d[yField]), smooth: type === 'line' }],
  };
}

export default function BaseChart({
  option,
  type,
  data = [],
  xField = '',
  yField = '',
  height = 400,
  width,
  loading,
  onChartReady,
  style,
}: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const resolvedOption: ChartOption = option || (type && data.length > 0 ? buildOption(type, data, xField, yField) : {});

  useEffect(() => {
    if (!chartRef.current) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
      onChartReady?.(instanceRef.current);
    }

    const mergedOption = { ...darkDefaults, ...resolvedOption };
    instanceRef.current.setOption(mergedOption, true);

    const handleResize = () => {
      instanceRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option, onChartReady]);

  useEffect(() => {
    if (loading) {
      instanceRef.current?.showLoading('default', {
        text: '',
        color: '#F0B90B',
        maskColor: 'rgba(13,17,23,0.6)',
      });
    } else {
      instanceRef.current?.hideLoading();
    }
  }, [loading]);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={chartRef}
      style={{
        width: width || '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    />
  );
}
