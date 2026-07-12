import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Space, Tag, Divider, message } from 'antd';
import { ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { mockPortfolioReport, mockDelay } from '@/lib/mock';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { PortfolioReport } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function PortfolioReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<PortfolioReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockDelay(mockPortfolioReport(), 500).then((r) => { setReport(r); setLoading(false); });
  }, []);

  if (loading || !report) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>组合回测报告 — 加载中...</Typography.Title>;
  }

  const strategyCols: ColumnsType<PortfolioReport['strategies'][0]> = [
    { title: '策略', dataIndex: 'name' },
    { title: '权重', dataIndex: 'weight', render: (v: number) => `${(v * 100).toFixed(0)}%` },
    { title: '收益', dataIndex: 'return', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{(v * 100).toFixed(1)}%</span> },
    { title: 'Sharpe', dataIndex: 'sharpe', render: (v: number) => v.toFixed(2) },
  ];

  const contribCols: ColumnsType<PortfolioReport['strategyContribution'][0]> = [
    { title: '策略', dataIndex: 'name' },
    { title: '贡献', dataIndex: 'contribution', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{(v * 100).toFixed(1)}%</span> },
  ];

  const corrCols = [
    { title: '策略 A', dataIndex: 'strategyA', width: 120 },
    { title: '策略 B', dataIndex: 'strategyB', width: 120 },
    {
      title: '相关系数', dataIndex: 'correlation',
      render: (v: number) => <Tag color={Math.abs(v) > 0.6 ? 'red' : Math.abs(v) > 0.4 ? 'orange' : 'green'}>{v.toFixed(2)}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/backtest/portfolio')} type="text" />
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>组合回测报告</Typography.Title>
        </Space>
        <Button icon={<ExportOutlined />} onClick={() => message.info('导出功能将在后续实现')}>导出报告</Button>
      </div>

      {/* 组合总绩效 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><StatCard title="总收益" value={report.totalReturn * 100} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="Sharpe" value={report.sharpeRatio} format="number" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="最大回撤" value={report.maxDrawdown * 100} format="percent" trend="down" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="胜率" value={report.winRate} format="percent" trend="up" /></Col>
      </Row>

      {/* 组合净值曲线 */}
      <Card title="组合净值曲线" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <BaseChart type="line" data={report.equityCurves.map((d) => ({ time: d.time, equity: d.equity }))} xField="time" yField="equity" height={320} />
      </Card>

      {/* 各策略绩效 + 策略贡献 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="各策略绩效" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Table columns={strategyCols} dataSource={report.strategies} rowKey="strategyId" pagination={false} size="middle" />
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 13 }}>
              组合 Sharpe: {report.sharpeRatio.toFixed(2)} | 最大回撤: {(report.maxDrawdown * 100).toFixed(1)}%
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="策略收益贡献" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Table columns={contribCols} dataSource={report.strategyContribution} rowKey="strategyId" pagination={false} size="middle" />
            <Divider style={{ margin: '12px 0' }} />
            <BaseChart
              type="pie"
              data={report.strategyContribution.map((s) => ({ name: s.name, value: Math.round(s.contribution * 10000) / 100 }))}
              xField="name" yField="value" height={200}
            />
          </Card>
        </Col>
      </Row>

      {/* 相关性矩阵 */}
      <Card title="策略间相关性" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table
          columns={corrCols}
          dataSource={report.correlation}
          rowKey={(r: PortfolioReport['correlation'][0]) => `${r.strategyA}-${r.strategyB}`}
          pagination={false} size="middle"
        />
      </Card>

      {/* 优化建议 */}
      <Card title="优化建议" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <ul style={{ color: 'var(--text-primary)', margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>EMA金叉与多因子选币相关性 0.45，分散效果较好</li>
          <li style={{ marginBottom: 8 }}>RSI超卖反弹权重 35%，但其 Sharpe(1.42) 低于组合均值(1.78)，建议调低权重至 25%</li>
          <li style={{ marginBottom: 8 }}>当前组合最大回撤 11.8%，低于各策略单独运行，说明多元化有效</li>
          <li>考虑加入波动率反向策略或商品类资产进一步降低相关性</li>
        </ul>
      </Card>
    </div>
  );
}
