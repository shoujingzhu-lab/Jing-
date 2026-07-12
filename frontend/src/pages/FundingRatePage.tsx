import { useState } from 'react';
import { Row, Col, Card, Typography, Table, Switch, Slider, Select, Statistic } from 'antd';
import { useFundingRates } from '@/hooks/useMarketData';
import BaseChart from '@/components/Chart/BaseChart';
import Skeleton from '@/components/ui/Skeleton';
import { formatPercent } from '@/lib/utils/format';

export default function FundingRatePage() {
  const { rates, loading } = useFundingRates();
  const [protectionEnabled, setProtectionEnabled] = useState(true);
  const [minutesBefore, setMinutesBefore] = useState(15);
  const [defaultAction, setDefaultAction] = useState('close_if_positive');

  const nextSettle = Math.min(...rates.map((r) => r.nextSettleTime), Date.now() + 8 * 3600000);
  const countdownMs = Math.max(0, nextSettle - Date.now());
  const countdownMinutes = Math.floor(countdownMs / 60000);
  const countdownSeconds = Math.floor((countdownMs % 60000) / 1000);

  const historyOption = {
    xAxis: { type: 'category' as const, data: Array.from({ length: 24 }, (_, i) => `${i}:00`) },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(2)}%` } },
    series: [{
      type: 'bar' as const,
      data: Array.from({ length: 24 }, () => Math.round((Math.random() - 0.5) * 0.002 * 10000) / 10000),
      itemStyle: { color: (p: { value: number }) => p.value >= 0 ? '#26A69A' : '#EF5350' },
    }],
  };

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>资金费率管理</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Row gutter={24}>
              <Col span={6}><Statistic title="当前加权平均费率" value={formatPercent((Math.random() - 0.5) * 0.05)} valueStyle={{ fontFamily: "'JetBrains Mono', monospace" }} /></Col>
              <Col span={8}><Statistic title="下次结算倒计时" value={`${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')}`} valueStyle={{ fontSize: 32, fontFamily: "'JetBrains Mono', monospace", color: countdownMinutes < 5 ? 'var(--red-trade)' : 'var(--brand)' }} /></Col>
              <Col span={10}><Statistic title="结算周期" value="每 8 小时" valueStyle={{ fontSize: 18 }} /></Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="资金费率表" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {loading ? <Skeleton type="table" rows={10} /> : (
              <Table dataSource={rates} rowKey="symbol" size="small" pagination={false} scroll={{ y: 350 }}
                columns={[
                  { title: '交易对', dataIndex: 'symbol', width: 120, render: (s: string) => <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{s}</span> },
                  { title: '当前费率', dataIndex: 'rate', width: 100, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{formatPercent(v * 100)}</span> },
                  { title: '预测费率', dataIndex: 'predictedRate', width: 100, align: 'right' as const, render: (v?: number) => v ? <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatPercent(v * 100)}</span> : '--' },
                  { title: '标记价格', dataIndex: 'markPrice', width: 110, align: 'right' as const, render: (v: number) => <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>${v.toLocaleString()}</span> },
                  { title: '距结算', dataIndex: 'nextSettleTime', width: 90, align: 'right' as const, render: (t: number) => `${Math.max(0, Math.floor((t - Date.now()) / 60000))}分钟` },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="BTC/USDT 历史费率" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <BaseChart option={historyOption} height={300} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title="策略资金费率保护" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Row gutter={[24, 16]} align="middle">
              <Col span={6}><Typography.Text style={{ color: 'var(--text-primary)' }}>全局开关</Typography.Text><br /><Switch checked={protectionEnabled} onChange={setProtectionEnabled} /></Col>
              <Col span={12}><Typography.Text style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>结算前 {minutesBefore} 分钟</Typography.Text>
                <Slider min={1} max={60} value={minutesBefore} onChange={setMinutesBefore} marks={{ 1: '1', 15: '15', 30: '30', 60: '60' }} style={{ maxWidth: 300 }} /></Col>
              <Col span={6}><Typography.Text style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>默认行为</Typography.Text>
                <Select value={defaultAction} onChange={setDefaultAction} style={{ width: '100%' }}
                  options={[{ value: 'close', label: '平仓规避' }, { value: 'hold', label: '继续持有' }, { value: 'close_if_positive', label: '仅正费率时平仓' }]} /></Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
