import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Button, Space, Tabs, Select, Divider, message } from 'antd';
import { ArrowLeftOutlined, ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { backtestApi } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { BacktestReport, BacktestMetrics, TradeDetail, DrawdownPeriod } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function BacktestReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('ALL');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await backtestApi.getReport(id);
        const r = (res.data as unknown as { data: BacktestReport })?.data
          || (res.data as unknown as BacktestReport);
        setReport(r as BacktestReport);
      } catch {
        message.error('加载回测报告失败，请确认后端服务已启动');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading || !report) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>回测报告 — 加载中...</Typography.Title>;
  }

  const m: BacktestMetrics = report.metrics;
  const sliceMap: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180 };
  const equityData = report.equityCurve
    ? (timeRange === 'ALL' ? report.equityCurve : report.equityCurve.slice(-(sliceMap[timeRange] || 30)))
    : [];

  const tradeCols: ColumnsType<TradeDetail> = [
    { title: '时间', render: (_: unknown, r: TradeDetail) => new Date(r.openTime).toLocaleDateString('zh-CN'), width: 100 },
    { title: '方向', dataIndex: 'side', width: 60, render: (v: string) => <Tag color={v === 'buy' ? 'green' : 'red'}>{v === 'buy' ? '买入' : '卖出'}</Tag> },
    { title: '入场价', dataIndex: 'entryPrice', render: (v: number) => `$${v.toFixed(2)}` },
    { title: '出场价', dataIndex: 'exitPrice', render: (v: number) => `$${v.toFixed(2)}` },
    { title: '数量', dataIndex: 'quantity' },
    { title: '盈亏', dataIndex: 'pnl', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>${v.toFixed(2)}</span> },
    { title: '收益率', dataIndex: 'pnlPercent', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{v.toFixed(2)}%</span> },
    { title: '持有时间', dataIndex: 'holdingDuration' },
    { title: '原因', dataIndex: 'reason', width: 130 },
  ];

  const ddCols: ColumnsType<DrawdownPeriod> = [
    { title: '开始', dataIndex: 'startDate' }, { title: '结束', dataIndex: 'endDate' },
    { title: '恢复日期', dataIndex: 'recoveryDate' },
    { title: '回撤幅度', dataIndex: 'drawdown', render: (v: number) => <span style={{ color: 'var(--red-trade)' }}>{(v * 100).toFixed(1)}%</span> },
    { title: '恢复天数', dataIndex: 'recoveryDays' },
    { title: '事件', dataIndex: 'eventLabel' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/backtest')} type="text" />
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>回测报告</Typography.Title>
        </Space>
        <Space>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 100 }}
            options={[{ value: '1M', label: '1个月' }, { value: '3M', label: '3个月' }, { value: '6M', label: '6个月' }, { value: 'ALL', label: '全部' }]} />
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button icon={<ExportOutlined />} onClick={() => message.info('导出功能将在后续实现')}>导出</Button>
        </Space>
      </div>

      {/* 关键指标 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><StatCard title="总收益" value={(m.totalReturn ?? 0) * 100} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="年化收益" value={(m.annualizedReturn ?? 0) * 100} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="Sharpe" value={m.sharpeRatio ?? 0} format="number" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="最大回撤" value={(m.maxDrawdown ?? 0) * 100} format="percent" trend="down" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="胜率" value={m.winRate ?? 0} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="盈亏比" value={m.profitFactor ?? 0} format="number" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="Calmar" value={m.calmarRatio ?? 0} format="number" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="总交易" value={m.totalTrades ?? 0} format="number" /></Col>
      </Row>

      {/* 净值曲线 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="净值曲线 & 回撤" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {equityData.length > 0 ? (
              <BaseChart type="line" data={equityData.map((d) => ({ time: d.time, equity: d.equity, drawdown: d.drawdown }))} xField="time" yField="equity" height={350} />
            ) : (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无净值曲线数据</div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="月度收益热力图" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {report.monthlyReturns && report.monthlyReturns.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 12 }}>
                {report.monthlyReturns.map((mr) => (
                  <div key={mr.month} style={{
                    padding: '8px 4px', textAlign: 'center', borderRadius: 4, fontSize: 12,
                    background: mr.return >= 0 ? `rgba(38,166,154,${Math.min(0.9, mr.return * 5 + 0.2)})` : `rgba(239,83,80,${Math.min(0.9, Math.abs(mr.return) * 5 + 0.2)})`,
                    color: '#fff',
                  }}>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{mr.month}</div>
                    <div>{mr.return > 0 ? '+' : ''}{mr.return.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无数据</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 基准对比 */}
      {report.benchmarkComparison && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card title="基准对比" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <table style={{ width: '100%', color: 'var(--text-primary)', lineHeight: 2.5 }}>
                <tbody>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>基准</td><td>{report.benchmarkComparison.benchmark}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>基准收益</td><td>{(report.benchmarkComparison.benchmarkReturn * 100).toFixed(1)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>策略收益</td><td style={{ color: 'var(--green-trade)' }}>{(report.benchmarkComparison.strategyReturn * 100).toFixed(1)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Alpha</td><td style={{ color: 'var(--green-trade)' }}>{(report.benchmarkComparison.alpha * 100).toFixed(2)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Beta</td><td>{report.benchmarkComparison.beta}</td></tr>
                </tbody>
              </table>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            {report.sampleValidation && (
              <Card title="样本外验证" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <table style={{ width: '100%', color: 'var(--text-primary)', lineHeight: 2.5 }}>
                  <tbody>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>样本内收益</td><td style={{ color: 'var(--green-trade)' }}>{(report.sampleValidation.inSampleReturn * 100).toFixed(1)}%</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>样本外收益</td><td style={{ color: 'var(--green-trade)' }}>{(report.sampleValidation.outSampleReturn * 100).toFixed(1)}%</td></tr>
                    <tr><td style={{ color: 'var(--text-secondary)' }}>过拟合评分</td><td><Tag color={report.sampleValidation.overfittingLevel === 'low' ? 'green' : report.sampleValidation.overfittingLevel === 'medium' ? 'orange' : 'red'}>{report.sampleValidation.overfittingScore.toFixed(2)} ({report.sampleValidation.overfittingLevel === 'low' ? '低' : report.sampleValidation.overfittingLevel === 'medium' ? '中' : '高'})</Tag></td></tr>
                  </tbody>
                </table>
              </Card>
            )}
          </Col>
        </Row>
      )}

      {/* 回撤期 */}
      {report.drawdownPeriods && report.drawdownPeriods.length > 0 && (
        <Card title="回撤区间" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
          <Table columns={ddCols} dataSource={report.drawdownPeriods} rowKey="startDate" pagination={false} size="middle" />
        </Card>
      )}

      {/* 交易记录 */}
      <Card title={`交易记录 (${report.trades?.length || 0})`} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table columns={tradeCols} dataSource={(report.trades || []).slice(0, 50)} rowKey="id" pagination={{ pageSize: 15 }} size="middle" scroll={{ x: 1000 }} />
      </Card>
    </div>
  );
}
