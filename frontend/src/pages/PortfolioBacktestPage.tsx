import { useState } from 'react';
import { Typography, Card, Table, Button, InputNumber, Slider, Space, Row, Col, Tag, message, Empty, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import BaseChart from '@/components/Chart/BaseChart';

interface StrategyWeight { key: string; name: string; return: number; sharpe: number; weight: number }

const INITIAL: StrategyWeight[] = [
  { key: 'strat-001', name: 'EMA金叉', return: 0.385, sharpe: 1.85, weight: 40 },
  { key: 'strat-002', name: 'RSI超卖反弹', return: 0.28, sharpe: 1.42, weight: 35 },
  { key: 'strat-005', name: '多因子选币', return: 0.32, sharpe: 1.65, weight: 25 },
];

// 模拟有效前沿数据
const frontierData = Array.from({ length: 30 }, (_, i) => {
  const risk = 0.05 + i * 0.008;
  return { risk, returnAmount: 0.08 + risk * 1.8 + Math.sin(i * 0.5) * 0.02 };
});

export default function PortfolioBacktestPage() {
  const [strategies, setStrategies] = useState<StrategyWeight[]>(INITIAL);
  const [totalCapital, setTotalCapital] = useState(50000);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2026-06-01');
  const [period, setPeriod] = useState('1h');
  const navigate = useNavigate();

  const totalWeight = strategies.reduce((s, r) => s + r.weight, 0);

  const addStrategy = () => {
    message.info('策略选择器将在后续实现');
  };

  const setWeight = (key: string, w: number) => {
    setStrategies((prev) => prev.map((s) => s.key === key ? { ...s, weight: w } : s));
  };

  const removeStrategy = (key: string) => {
    setStrategies((prev) => prev.filter((s) => s.key !== key));
  };

  const expectedReturn = strategies.reduce((s, r) => s + r.return * (r.weight / 100), 0);
  const avgSharpe = strategies.reduce((s, r) => s + r.sharpe * (r.weight / 100), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>策略组合回测</Typography.Title>
        <Space>
          <Button icon={<PlusOutlined />} onClick={addStrategy}>添加策略</Button>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => { message.success('组合回测已提交'); navigate('/backtest/portfolio/portfolio-001'); }}>启动回测</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* 左侧 — 策略权重分配 */}
        <Col xs={24} lg={12}>
          <Card title="策略权重分配" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {strategies.length === 0 ? (
              <Empty description="尚未添加策略" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                <Button type="primary" icon={<PlusOutlined />} onClick={addStrategy}>添加策略</Button>
              </Empty>
            ) : (
              <>
                {strategies.map((s) => (
                  <div key={s.key} style={{ marginBottom: 20, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Space>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</span>
                        <Tag color="blue">收益: {(s.return * 100).toFixed(1)}%</Tag>
                        <Tag>Sharpe: {s.sharpe}</Tag>
                      </Space>
                      <Space>
                        <InputNumber style={{ width: 75 }} value={s.weight} onChange={(v) => setWeight(s.key, v || 0)} min={0} max={100} suffix="%" size="small" />
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeStrategy(s.key)} />
                      </Space>
                    </div>
                    <Slider value={s.weight} onChange={(v) => setWeight(s.key, v)} min={0} max={100} tooltip={{ formatter: (v) => `${v}%` }} />
                  </div>
                ))}

                <div style={{ textAlign: 'right', color: totalWeight === 100 ? 'var(--green-trade)' : 'var(--red-trade)', marginTop: 8 }}>
                  总权重: {totalWeight}% {totalWeight !== 100 && '（建议调整为 100%）'}
                </div>
              </>
            )}
          </Card>

          {/* 回测参数 */}
          <Card title="回测参数" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
            <Row gutter={[16, 12]}>
              <Col span={12}><div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>初始资金 ($)</div><InputNumber style={{ width: '100%' }} value={totalCapital} onChange={(v) => setTotalCapital(v || 50000)} /></Col>
              <Col span={12}><div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>K线周期</div><Select value={period} onChange={setPeriod} style={{ width: '100%' }} options={['1m','5m','15m','1h','4h','1d'].map((v) => ({ value: v, label: v }))} /></Col>
              <Col span={12}><div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>开始日期</div><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '4px 11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)' }} /></Col>
              <Col span={12}><div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>结束日期</div><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '4px 11px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)' }} /></Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧 — 组合预览 */}
        <Col xs={24} lg={12}>
          <Card title="组合预期指标" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-primary)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>预期收益</div>
                  <div style={{ color: 'var(--green-trade)', fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>{(expectedReturn * 100).toFixed(1)}%</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-primary)', borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>加权 Sharpe</div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 'bold', marginTop: 8 }}>{avgSharpe.toFixed(2)}</div>
                </div>
              </Col>
            </Row>
          </Card>

          <Card title="有效前沿 & 均值方差优化" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
            <BaseChart
              type="scatter"
              data={frontierData}
              xField="risk"
              yField="returnAmount"
              height={280}
            />
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              X轴: 风险(标准差) / Y轴: 预期收益
              {strategies.map((s) => (
                <span key={s.key} style={{ marginLeft: 8, color: 'var(--text-primary)' }}>● {s.name}</span>
              ))}
            </div>
          </Card>

          {/* 策略相关性矩阵预览 */}
          <Card title="策略相关性矩阵" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <Table
              dataSource={strategies.map((s, i) => ({
                strategy: s.name,
                ...Object.fromEntries(strategies.map((t, j) => [t.name, i === j ? 1.0 : parseFloat((0.28 + Math.random() * 0.3).toFixed(2))])),
              }))}
              columns={[
                { title: '', dataIndex: 'strategy', key: 'strategy', width: 120 },
                ...strategies.map((s) => ({ title: s.name, dataIndex: s.name, key: s.name, render: (v: number) => <span style={{ color: v > 0.7 ? 'var(--red-trade)' : v > 0.4 ? '#FF9800' : 'var(--green-trade)' }}>{v.toFixed(2)}</span> })),
              ]}
              pagination={false} size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
