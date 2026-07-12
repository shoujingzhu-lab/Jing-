import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Select, Space, Button, Progress } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { mockAltcoinCorrelation, mockDelay } from '@/lib/mock';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { AltcoinCorrelation } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function AltcoinCorrelationPage() {
  const [data, setData] = useState<AltcoinCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    setLoading(true);
    mockDelay(mockAltcoinCorrelation(), 400).then((d) => { setData(d); setLoading(false); });
  }, [period]);

  // 相关度热力图数据
  const heatmapData = data.flatMap((r, ri) => [
    { x: 'BTC', y: r.name, value: r.btcCorrelation },
    { x: 'ETH', y: r.name, value: r.ethCorrelation },
  ]);

  // BTC散点图
  const scatterData = data.map((r) => ({
    name: r.name,
    btcCorr: r.btcCorrelation,
    beta: r.beta,
    mcap: r.marketCap,
  }));

  const cols: ColumnsType<AltcoinCorrelation> = [
    { title: '币种', dataIndex: 'name', width: 130, render: (v: string, r: AltcoinCorrelation) => <Space><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.symbol}</span></Space> },
    { title: '市值', dataIndex: 'marketCap', width: 130, render: (v: number) => `$${(v / 1e9).toFixed(0)}B` },
    { title: 'BTC关联', dataIndex: 'btcCorrelation', width: 140, render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" strokeColor={v > 0.7 ? '#EF5350' : v > 0.5 ? '#FF9800' : '#26A69A'} /> },
    { title: 'ETH关联', dataIndex: 'ethCorrelation', width: 140, render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" strokeColor={v > 0.7 ? '#EF5350' : v > 0.5 ? '#FF9800' : '#26A69A'} /> },
    { title: 'Beta', dataIndex: 'beta', width: 100, render: (v: number) => <Tag color={v > 1.3 ? 'red' : v > 1 ? 'orange' : 'green'}>{v.toFixed(2)}</Tag> },
  ];

  // 分散化评分
  const avgCorr = data.reduce((s, r) => s + r.btcCorrelation, 0) / (data.length || 1);
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
        <Col xs={12} sm={6}><StatCard title="高Beta币种" value={data.filter((r) => r.beta > 1.3).length} format="number" /></Col>
        <Col xs={12} sm={6}><StatCard title="低关联币种" value={data.filter((r) => r.btcCorrelation < 0.5).length} format="number" trend="up" /></Col>
      </Row>

      {/* 相关性热力图 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="相关性热力图（热力矩阵）" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
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
          </Card>
        </Col>

        {/* BTC Beta 散点图 */}
        <Col xs={24} lg={10}>
          <Card title="BTC Beta 散点图" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <BaseChart type="scatter" data={scatterData} xField="btcCorr" yField="beta" height={350} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>X轴: BTC 相关系数 / Y轴: Beta / 气泡: 市值</div>
          </Card>
        </Col>
      </Row>

      {/* 表格 */}
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table columns={cols} dataSource={data} rowKey="symbol" loading={loading} pagination={false} size="middle" />
      </Card>

      {/* 分散化建议 */}
      <Card title="分散化建议" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <ul style={{ color: 'var(--text-primary)', margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>分散化评分 {diversificationScore}% {diversificationScore > 50 ? '✅ 良好' : '⚠️ 偏低，建议增加低关联资产'}</li>
          <li style={{ marginBottom: 8 }}>DOGE 与 BTC 关联度最低 ({(data.find((r) => r.symbol === 'DOGE/USDT')?.btcCorrelation || 0) * 100}%)，可用于降低组合波动</li>
          <li style={{ marginBottom: 8 }}>SOL、AVAX 为高 Beta 币种，适合在牛市中放大收益</li>
          <li>建议将 BTC 关联度 &lt;50% 的币种配置比例提高至 30% 以上以增强分散效果</li>
        </ul>
      </Card>
    </div>
  );
}
