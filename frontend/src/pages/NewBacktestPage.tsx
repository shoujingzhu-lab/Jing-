import { useState } from 'react';
import { Typography, Card, Steps, Button, Space, Select, Table, DatePicker, InputNumber, Form, Tag, message, Result, Row, Col } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import BaseChart from '@/components/Chart/BaseChart';

interface StrategyOption { id: string; name: string; type: string; lastReturn?: number; sharpe?: number }

const STRATEGIES: StrategyOption[] = [
  { id: 'strat-001', name: 'EMA金叉策略', type: 'visual', lastReturn: 0.385, sharpe: 1.85 },
  { id: 'strat-002', name: 'RSI超卖反弹', type: 'visual', lastReturn: 0.28, sharpe: 1.42 },
  { id: 'strat-003', name: '布林带突破', type: 'visual', lastReturn: 0.22, sharpe: 1.35 },
  { id: 'strat-005', name: '多因子选币', type: 'code', lastReturn: 0.32, sharpe: 1.65 },
];

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'DOGE/USDT', 'AVAX/USDT', 'LINK/USDT'];
const PERIODS = [
  { value: '1m', label: '1分钟' }, { value: '5m', label: '5分钟' }, { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' }, { value: '4h', label: '4小时' }, { value: '1d', label: '日线' },
];

export default function NewBacktestPage() {
  const [step, setStep] = useState(0);
  const [strategyId, setStrategyId] = useState<string>();
  const [symbols, setSymbols] = useState<string[]>(['BTC/USDT']);
  const [period, setPeriod] = useState('1h');
  const [startDate, setStartDate] = useState<string>('2025-01-01');
  const [endDate, setEndDate] = useState<string>('2026-06-01');
  const [initialCapital, setInitialCapital] = useState(10000);
  const [feeRate, setFeeRate] = useState(0.001);
  const [slippage, setSlippage] = useState(0.0005);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const selected = STRATEGIES.find((s) => s.id === strategyId);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    setStep(4);
  };

  const stepItems = [
    { title: '选择策略' },
    { title: '配置参数' },
    { title: '预览确认' },
    { title: '启动回测' },
  ];

  const stratCols: ColumnsType<StrategyOption> = [
    { title: '策略名称', dataIndex: 'name', render: (v: string) => <a style={{ color: 'var(--gold)' }}>{v}</a> },
    { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v === 'visual' ? '可视化' : '代码'}</Tag> },
    { title: '最近收益', dataIndex: 'lastReturn', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{(v * 100).toFixed(1)}%</span> },
    { title: 'Sharpe', dataIndex: 'sharpe', render: (v: number) => v.toFixed(2) },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>新建回测</Typography.Title>

      <Steps current={step} items={stepItems} style={{ marginBottom: 24 }} />

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {/* Step 0 — 选择策略 */}
        {step === 0 && (
          <div>
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>选择回测策略</Typography.Title>
            <Table
              columns={stratCols} dataSource={STRATEGIES} rowKey="id" pagination={false} size="middle"
              rowSelection={{ type: 'radio', selectedRowKeys: strategyId ? [strategyId] : [], onChange: (keys) => setStrategyId(keys[0] as string) }}
              onRow={(r) => ({ onClick: () => setStrategyId(r.id), style: { cursor: 'pointer', background: strategyId === r.id ? 'rgba(240,185,11,0.08)' : undefined } })}
            />
          </div>
        )}

        {/* Step 1 — 参数配置 */}
        {step === 1 && (
          <div>
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>回测参数</Typography.Title>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item label="交易对" required><Select mode="multiple" value={symbols} onChange={setSymbols} options={SYMBOLS.map((s) => ({ value: s, label: s }))} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="K线周期" required><Select value={period} onChange={setPeriod} options={PERIODS} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={12} md={6}><Form.Item label="开始日期"><DatePicker style={{ width: '100%' }} value={undefined} onChange={(_, d) => setStartDate(d || '2025-01-01')} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="结束日期"><DatePicker style={{ width: '100%' }} value={undefined} onChange={(_, d) => setEndDate(d || '2026-06-01')} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="初始资金 ($)"><InputNumber style={{ width: '100%' }} value={initialCapital} onChange={(v) => setInitialCapital(v || 10000)} min={100} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="手续费率 (%)"><InputNumber style={{ width: '100%' }} value={feeRate * 100} onChange={(v) => setFeeRate((v || 0.1) / 100)} min={0} max={5} step={0.01} /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="滑点 (%)"><InputNumber style={{ width: '100%' }} value={slippage * 100} onChange={(v) => setSlippage((v || 0.05) / 100)} min={0} max={1} step={0.01} /></Form.Item></Col>
            </Row>

            {/* 高级设置 */}
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginTop: 24, marginBottom: 12 }}>高级设置</Typography.Title>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Form.Item label="撮合模式"><Select defaultValue="next_open" options={[
                  { value: 'next_open', label: '下一根开盘' }, { value: 'current_close', label: '当前收盘' }, { value: 'vwap', label: 'VWAP' }, { value: 'counterparty', label: '对手价' },
                ]} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="保证金模式"><Select defaultValue="cross" options={[{ value: 'cross', label: '全仓' }, { value: 'isolated', label: '逐仓' }]} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="杠杆倍数"><Select defaultValue={1} options={[1, 2, 3, 5, 10].map((v) => ({ value: v, label: `${v}x` }))} style={{ width: '100%' }} /></Form.Item>
              </Col>
            </Row>

            {/* 参数优化 */}
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginTop: 24, marginBottom: 12 }}>参数优化</Typography.Title>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}>
                <Form.Item label="优化方法"><Select defaultValue={undefined} allowClear placeholder="不启用" options={[
                  { value: 'grid', label: '网格搜索' }, { value: 'bayesian', label: '贝叶斯优化' }, { value: 'genetic', label: '遗传算法' },
                ]} style={{ width: '100%' }} /></Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item label="迭代次数"><InputNumber style={{ width: '100%' }} defaultValue={100} min={10} /></Form.Item></Col>
            </Row>

            {/* 样本外验证 */}
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginTop: 24, marginBottom: 12 }}>样本外验证</Typography.Title>
            <Row gutter={[24, 16]}>
              <Col xs={24} md={8}><Form.Item label="训练/测试分割"><Select defaultValue={undefined} allowClear placeholder="不启用" options={[{ value: '70/30', label: '70% / 30%' }, { value: '80/20', label: '80% / 20%' }]} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="Walk-Forward"><Select defaultValue={undefined} allowClear placeholder="不启用" options={[{ value: '3m', label: '窗口 3 月 / 步长 1 月' }, { value: '6m', label: '窗口 6 月 / 步长 2 月' }]} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
          </div>
        )}

        {/* Step 2 — 预览 */}
        {step === 2 && (
          <div>
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>回测配置预览</Typography.Title>
            <Card size="small" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <table style={{ width: '100%', color: 'var(--text-primary)', lineHeight: 2.2 }}>
                <tbody>
                  <tr><td style={{ color: 'var(--text-secondary)', width: 140 }}>策略</td><td><Tag color="gold">{selected?.name || '-'}</Tag></td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>交易对</td><td>{symbols.join(', ')}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>K线周期</td><td>{period}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>回测区间</td><td>{startDate} ~ {endDate}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>初始资金</td><td>${initialCapital.toLocaleString()}</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>手续费</td><td>{(feeRate * 100).toFixed(2)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>滑点</td><td>{(slippage * 100).toFixed(2)}%</td></tr>
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* Step 3 — 提交中 */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            {submitting ? (
              <div><Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>正在提交回测任务...</Typography.Title>
                <BaseChart type="line" data={[]} xField="" yField="" height={100} loading /></div>
            ) : null}
          </div>
        )}

        {/* Step 4 — 完成 */}
        {step === 4 && (
          <Result status="success" title="回测任务已提交" subTitle={`${selected?.name || '策略'} — ${symbols.join(', ')} | ${startDate} ~ ${endDate}`}
            extra={[
              <Button type="primary" key="view" onClick={() => navigate('/backtest/bt-001')} icon={<CheckCircleOutlined />}>查看报告</Button>,
              <Button key="list" onClick={() => navigate('/backtest')}>返回列表</Button>,
            ]}
          />
        )}

        {/* 导航按钮 */}
        {step < 3 && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Button icon={<ArrowLeftOutlined />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>上一步</Button>
            <Space>
              <Button onClick={() => navigate('/backtest')}>取消</Button>
              <Button type="primary" icon={<ArrowRightOutlined />} disabled={step === 0 && !strategyId} onClick={() => {
                if (step === 2) { setStep(3); handleSubmit(); } else setStep((s) => s + 1);
              }}>{step === 2 ? '启动回测' : '下一步'}</Button>
            </Space>
          </div>
        )}
      </Card>
    </div>
  );
}
