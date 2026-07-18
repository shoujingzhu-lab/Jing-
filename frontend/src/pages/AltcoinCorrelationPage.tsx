import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Select, Space, Button, Progress } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { aiApi } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { AltcoinCorrelation } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function AltcoinCorrelationPage() {
  const [data, setData] = useState<AltcoinCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await aiApi.getCorrelation();
        const d = (res.data as unknown as { data: AltcoinCorrelation[] })?.data
          || (res.data as unknown as AltcoinCorrelation[]) || [];
        setData(Array.isArray(d) ? d : []);
      } catch {
        // 后端未启动
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  // 相关度热力图数据
  const heatmapData = data.flatMap((r) => [
    { x: 'BTC', y: r.name, value: r.btcCorrelation ?? 0 },
    { x: 'ETH', y: r.name, value: r.ethCorrelation ?? 0 },
  ]);

  // BTC散点图
  const scatterData = data.map((r) => ({
    name: r.name,
    btcCorr: r.btcCorrelation ?? 0,
    beta: r.beta ?? 0,
    mcap: r.marketCap ?? 0,
  }));

  const cols: ColumnsType<AltcoinCorrelation> = [
    { title: '币种', dataIndex: 'name', width: 130, render: (v: string, r: AltcoinCorrelation) => <Space><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.symbol}</span></Space> },
    { title: '市值', dataIndex: 'marketCap', width: 130, render: (v: number) => `$${((v ?? 0) / 1e9).toFixed(0)}B` },
    { title: 'BTC关联', dataIndex: 'btcCorrelation', width: 140, render: (v: number) => <Progress percent={Math.round((v ?? 0) * 100)} size="small" strokeColor={(v ?? 0) > 0.7 ? '#EF5350' : (v ?? 0) > 0.5 ? '#FF9800' : '#26A69A'} /> },
    { title: 'ETH关联', dataIndex: 'ethCorrelation', width: 140, render: (v: number) => <Progress percent={Math.round((v ?? 0) * 100)} size="small" strokeColor={(v ?? 0) > 0.7 ? '#EF5350' : (v ?? 0) > 0.5 ? '#FF9800' : '#26A69A'} /> },
    { title: 'Beta', dataIndex: 'beta', width: 100, render: (v: number) => <Tag color={(v ?? 0) > 1.3 ? 'red' : (v ?? 0) > 1 ? 'orange' : 'green'}>{(v ?? 0).toFixed(2)}</Tag> },
  ];

  // 分散化评分
  const avgCorr = data.length > 0 ? data.reduce((s, r) => s + (r.btcCorrelation ?? 0), 0) / data.length : 1;
  const diversificationScore = Math.round((1 - avgCorr) * 100);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>山寨币关联分析</Typography.Title>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }} options={[{ value: '7d', label: '近7天' }, { value: '30d', label: '近30天' }, { value: '90d', label: '近90天' }]} />
          <Button icon={<ReloadOutlined />}>刷新</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><StatCard title="分散化评分" value={diversificationScore} format="number" trend={diversificationScore > 50 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={6}><StatCard title="平均BTC关联" value={avgCorr * 100} format="percent" trend={avgCorr < 0.5 ? 'up' : 'down'} /></Col>
        <Col xs={12} sm={6}><StatCard title="高Beta币种" value={data.filter((r) => (r.beta ?? 0) > 1.3).length} format="number" /></Col>
        <Col xs={12} sm={6}><StatCard title="低关联币种" value={data.filter((r) => (r.btcCorrelation ?? 0) < 0.5).length} format="number" trend="up" /></Col>
      </Row>

      {/* 相关性热力图 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="相关性热力图" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {data.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 12 }}>币种</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 12 }}>BTC</th>
                      <th style={{ padding: 8, color: 'var(--text-secondary)', fontSize: 12 }}>ETH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r) => (
                      <tr key={r.symbol} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</td>
                        <td style={{ padding: 8 }}><div style={{ height: 28, borderRadius: 4, background: `rgba(${r.btcCorrelation > 0.7 ? '239,83,80' : r.btcCorrelation > 0.5 ? '255,152,0' : '38,166,154'},${r.btcCorrelation})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{(r.btcCorrelation * 100).toFixed(0)}%</div></td>
                        <td style={{ padding: 8 }}><div style={{ height: 28, borderRadius: 4, background: `rgba(${r.ethCorrelation > 0.7 ? '239,83,80' : r.ethCorrelation > 0.5 ? '255,152,0' : '38,166,154'},${r.ethCorrelation})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{(r.ethCorrelation * 100).toFixed(0)}%</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无数据，请确认后端服务已启动</div>
            )}
          </Card>
        </Col>

        {/* BTC Beta 散点图 */}
        <Col xs={24} lg={10}>
          <Card title="BTC Beta 散点图" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {data.length > 0 ? (
              <>
                <BaseChart type="scatter" data={scatterData} xField="btcCorr" yField="beta" height={350} />
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>X轴: BTC 相关系数 / Y轴: Beta / 气泡: 市值</div>
              </>
            ) : (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无数据</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 表格 */}
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table columns={cols} dataSource={data} rowKey="symbol" loading={loading} pagination={false} size="middle" />
      </Card>
    </div>
  );
}
