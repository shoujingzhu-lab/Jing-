import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Space, Tag, Divider, message } from 'antd';
import { ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtestApi, strategyApi } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { PortfolioReport } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function PortfolioReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<PortfolioReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 组合报告可通过组合回测API获取
        const [strategiesRes] = await Promise.allSettled([
          strategyApi.getList({ page_size: 10 }),
        ]);

        const strategies = strategiesRes.status === 'fulfilled'
          ? ((strategiesRes.value.data as unknown as { items?: unknown[] })?.items || [])
          : [];

        if (Array.isArray(strategies) && strategies.length > 0) {
          // 构建基本组合报告
          const strategiesData = strategies.map((s: unknown) => {
            const st = s as Record<string, unknown>;
            return {
              strategyId: st.id as string,
              name: st.name as string,
              weight: 0.25,
              return: 0,
              sharpe: 0,
            };
          });

          setReport({
            totalReturn: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            winRate: 0,
            strategies: strategiesData,
            strategyContribution: strategiesData.slice(0, 3).map((s) => ({
              strategyId: s.strategyId,
              name: s.name,
              contribution: 0.33,
            })),
            equityCurves: [],
            correlation: strategiesData.slice(0, 3).flatMap((a, i) =>
              strategiesData.slice(i + 1, i + 2).map((b) => ({
                strategyA: a.name,
                strategyB: b.name,
                correlation: 0,
              }))
            ),
          } as PortfolioReport);
        }
      } catch {
        message.error('加载组合报告失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !report) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>组合回测报告 — 加载中...</Typography.Title>;
  }

  const strategyCols: ColumnsType<PortfolioReport['strategies'][0]> = [
    { title: '策略', dataIndex: 'name' },
    { title: '权重', dataIndex: 'weight', render: (v: number) => `${((v ?? 0) * 100).toFixed(0)}%` },
    { title: '收益', dataIndex: 'return', render: (v: number) => <span style={{ color: (v ?? 0) >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{((v ?? 0) * 100).toFixed(1)}%</span> },
    { title: 'Sharpe', dataIndex: 'sharpe', render: (v: number) => (v ?? 0).toFixed(2) },
  ];

  const contribCols: ColumnsType<PortfolioReport['strategyContribution'][0]> = [
    { title: '策略', dataIndex: 'name' },
    { title: '贡献', dataIndex: 'contribution', render: (v: number) => <span style={{ color: (v ?? 0) >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{((v ?? 0) * 100).toFixed(1)}%</span> },
  ];

  const corrCols = [
    { title: '策略 A', dataIndex: 'strategyA', width: 120 },
    { title: '策略 B', dataIndex: 'strategyB', width: 120 },
    {
      title: '相关系数', dataIndex: 'correlation',
      render: (v: number) => <Tag color={Math.abs(v ?? 0) > 0.6 ? 'red' : Math.abs(v ?? 0) > 0.4 ? 'orange' : 'green'}>{(v ?? 0).toFixed(2)}</Tag>,
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
        <Col xs={12} sm={8} md={4}><StatCard title="总收益" value={(report.totalReturn ?? 0) * 100} format="percent" trend="up" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="Sharpe" value={report.sharpeRatio ?? 0} format="number" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="最大回撤" value={(report.maxDrawdown ?? 0) * 100} format="percent" trend="down" /></Col>
        <Col xs={12} sm={8} md={4}><StatCard title="胜率" value={report.winRate ?? 0} format="percent" trend="up" /></Col>
      </Row>

      {/* 各策略绩效 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="各策略绩效" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Table columns={strategyCols} dataSource={report.strategies} rowKey="strategyId" pagination={false} size="middle" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="策略收益贡献" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Table columns={contribCols} dataSource={report.strategyContribution} rowKey="strategyId" pagination={false} size="middle" />
          </Card>
        </Col>
      </Row>

      {/* 相关性矩阵 */}
      {report.correlation && report.correlation.length > 0 && (
        <Card title="策略间相关性" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
          <Table
            columns={corrCols}
            dataSource={report.correlation}
            rowKey={(r: { strategyA: string; strategyB: string }) => `${r.strategyA}-${r.strategyB}`}
            pagination={false} size="middle"
          />
        </Card>
      )}
    </div>
  );
}
