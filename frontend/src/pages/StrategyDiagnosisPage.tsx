import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Progress, Button, Space, Switch, Select, Divider, message } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { mockStrategyDiagnosis, mockDelay } from '@/lib/mock';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { StrategyHealth, AttributionResult, ParamSensitivity, OptimizationSuggestion, AdaptiveModeConfig } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const DIM_LABELS: Record<string, string> = {
  profitability: '盈利', risk: '风控', stability: '稳定', overfittingRisk: '抗过拟合', adaptability: '适应',
};

export default function StrategyDiagnosisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [health, setHealth] = useState<StrategyHealth | null>(null);
  const [attribution, setAttribution] = useState<AttributionResult | null>(null);
  const [sensitivity, setSensitivity] = useState<ParamSensitivity[]>([]);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [adaptive, setAdaptive] = useState<AdaptiveModeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockDelay(mockStrategyDiagnosis(id || 'strat-001'), 500).then((d) => {
      setHealth(d.health); setAttribution(d.attribution); setSensitivity(d.paramSensitivity);
      setSuggestions(d.suggestions); setAdaptive(d.adaptiveMode); setLoading(false);
    });
  }, [id]);

  if (loading || !health) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>策略诊断 — 加载中...</Typography.Title>;
  }

  // 健康度仪表盘
  const scoreColor = health.score >= 80 ? '#26A69A' : health.score >= 60 ? '#FF9800' : '#EF5350';
  const gaugeOpt = {
    series: [{ type: 'gauge', startAngle: 200, endAngle: -20, center: ['50%', '60%'], radius: '85%', min: 0, max: 100,
      progress: { show: true, width: 8, itemStyle: { color: scoreColor } },
      axisLine: { lineStyle: { width: 8, color: [[health.score / 100, scoreColor], [1, '#333']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { offsetCenter: [0, '55%'], valueAnimation: true, formatter: '{value}', fontSize: 22, color: 'var(--text-primary)' },
      data: [{ value: health.score, name: '健康度' }],
    }],
  };

  const sensCols: ColumnsType<ParamSensitivity & { key: string }> = [
    { title: '参数', dataIndex: 'paramName', width: 120 },
    { title: '取值区间', render: (_: unknown, r: ParamSensitivity) => `${r.paramValues[0]} ~ ${r.paramValues[r.paramValues.length - 1]}` },
    {
      title: 'Sharpe 曲线', render: (_: unknown, r: ParamSensitivity) => (
        <div style={{ width: 200, height: 30 }}>
          <BaseChart type="line" data={r.paramValues.map((v, i) => ({ x: v, y: r.sharpeValues[i] }))} xField="x" yField="y" height={30} width={200} />
        </div>
      ),
    },
    { title: '最优 Sharpe', render: (_: unknown, r: ParamSensitivity) => <span style={{ color: 'var(--gold)' }}>{Math.max(...r.sharpeValues).toFixed(2)}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analysis')} type="text" />
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>{health.strategyName} — 诊断报告</Typography.Title>
          <Tag color={health.score >= 80 ? 'green' : health.score >= 60 ? 'orange' : 'red'}>{health.score}分</Tag>
        </Space>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>

      {/* 健康仪表 + 能力维度 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <BaseChart option={gaugeOpt} height={240} />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="能力维度" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {Object.entries(health.dimensions).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{DIM_LABELS[key] || key}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{value}/100</span>
                </div>
                <Progress percent={value} showInfo={false} strokeColor={value >= 80 ? '#26A69A' : value >= 60 ? '#FF9800' : '#EF5350'} size="small" />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* 问题标签 */}
      {health.issues.length > 0 && (
        <Card size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
          <div><span style={{ color: '#FF9800' }}>⚠️ 发现问题: </span>
            {health.issues.map((issue, i) => <Tag key={i} color="warning">{issue}</Tag>)}
          </div>
        </Card>
      )}

      {/* 收益归因 + 费用侵蚀 */}
      {attribution && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card title="收益归因" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <table style={{ width: '100%', color: 'var(--text-primary)', lineHeight: 2.5 }}>
                <tbody>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Beta 收益</td><td style={{ color: 'var(--green-trade)' }}>+{(attribution.categories.beta * 100).toFixed(1)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>Alpha 收益</td><td style={{ color: 'var(--green-trade)' }}>+{(attribution.categories.alpha * 100).toFixed(2)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>资金费率</td><td style={{ color: 'var(--red-trade)' }}>{(attribution.categories.fundingFee * 100).toFixed(2)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>交易手续费</td><td style={{ color: 'var(--red-trade)' }}>{(attribution.categories.tradingFee * 100).toFixed(1)}%</td></tr>
                  <tr><td style={{ color: 'var(--text-secondary)' }}>费用侵蚀率</td>
                    <td><Tag color={attribution.feeErosionWarning ? 'red' : 'green'}>{attribution.feeErosionPercent.toFixed(1)}% {attribution.feeErosionWarning ? '⚠️ 偏高' : '✅ 正常'}</Tag></td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="过拟合指示器" size="small" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>过拟合风险</div>
                <Progress type="circle" percent={health.dimensions.overfittingRisk} size={100} strokeColor={health.dimensions.overfittingRisk >= 80 ? '#26A69A' : health.dimensions.overfittingRisk >= 60 ? '#FF9800' : '#EF5350'} />
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
                  {health.dimensions.overfittingRisk >= 80 ? '过拟合风险低，策略泛化能力良好' : health.dimensions.overfittingRisk >= 60 ? '存在一定过拟合风险，建议样本外验证' : '⚠️ 过拟合风险较高，建议重新优化参数'}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* 参数敏感性分析 */}
      <Card title="参数敏感性分析" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        {sensitivity.map((s) => (
          <div key={s.paramName} style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ color: 'var(--text-primary)' }}>{s.paramName}</Typography.Text>
            <BaseChart type="line"
              data={s.paramValues.map((v, i) => ({ param: v, sharpe: s.sharpeValues[i], drawdown: s.drawdownValues[i] * 100 }))}
              xField="param" yField="sharpe" height={200}
            />
          </div>
        ))}
      </Card>

      {/* 优化建议 */}
      <Card title="优化建议" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        {suggestions.map((sug) => (
          <div key={sug.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            <Space>
              <Tag color={sug.impact === 'high' ? 'red' : sug.impact === 'medium' ? 'orange' : 'blue'}>{sug.impact === 'high' ? '高影响' : sug.impact === 'medium' ? '中影响' : '低影响'}</Tag>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sug.title}</span>
            </Space>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{sug.description}</div>
            {sug.currentValue && <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>当前: {sug.currentValue} → 建议: {sug.suggestedValue}</div>}
          </div>
        ))}
      </Card>

      {/* 智能自适应面板 */}
      {adaptive && (
        <Card title={<span><SettingOutlined /> 智能自适应</span>} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
          <Row gutter={[24, 12]}>
            <Col xs={24} md={6}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>启用自适应</div>
              <Switch defaultChecked={adaptive.enabled} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>调整频率</div>
              <Select defaultValue={adaptive.adjustFrequency} style={{ width: '100%' }} options={['daily', 'weekly', 'monthly'].map((v) => ({ value: v, label: v === 'daily' ? '每日' : v === 'weekly' ? '每周' : '每月' }))} />
            </Col>
            <Col xs={24} md={12}>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>可调参数</div>
              <Space wrap>{adaptive.adjustableParams.map((p) => <Tag key={p} color="blue">{p}</Tag>)}</Space>
            </Col>
          </Row>
          <Divider />
          <Button type="primary" onClick={() => message.success('自适应配置已保存')}>保存配置</Button>
        </Card>
      )}
    </div>
  );
}
