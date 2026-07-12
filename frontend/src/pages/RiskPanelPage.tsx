import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Button, Tag, Alert, Switch, Slider, Select, InputNumber, Space, Divider, message, Modal } from 'antd';
import { WarningOutlined, StopOutlined, LockOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons';
import StatCard from '@/components/ui/StatCard';
import StatusTag from '@/components/ui/StatusTag';
import BaseChart from '@/components/Chart/BaseChart';
import { mockRiskOverview, mockStrategyRisks, mockRiskPositions, mockRiskEvents, mockRiskRules, mockMeltdownStatus, mockDelay } from '@/lib/mock';
import type { RiskOverview, StrategyRisk, Position, RiskEvent, RiskRuleConfig, MeltdownStatus } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function RiskPanelPage() {
  const [overview, setOverview] = useState<RiskOverview | null>(null);
  const [strategies, setStrategies] = useState<StrategyRisk[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [rules, setRules] = useState<RiskRuleConfig | null>(null);
  const [meltdown, setMeltdown] = useState<MeltdownStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [ov, st, po, ev, ru, me] = await Promise.all([
      mockDelay(mockRiskOverview(), 200),
      mockDelay(mockStrategyRisks(), 250),
      mockDelay(mockRiskPositions(), 250),
      mockDelay(mockRiskEvents(), 200),
      mockDelay(mockRiskRules(), 150),
      mockDelay(mockMeltdownStatus(), 150),
    ]);
    setOverview(ov); setStrategies(st); setPositions(po); setEvents(ev); setRules(ru); setMeltdown(me);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // 熔断解除
  const handleRecover = () => {
    Modal.confirm({
      title: '确认解除熔断？', content: '请确认已排查根本原因。解除后策略将恢复运行，冷却期 12 小时。',
      okText: '确认解除', cancelText: '取消', okButtonProps: { danger: true },
      onOk: () => { setMeltdown({ isActive: false, affectedStrategies: [] }); message.success('熔断已解除'); },
    });
  };

  const gaugeOption = (value: number, max: number, name: string, color: string) => ({
    series: [{ type: 'gauge', startAngle: 200, endAngle: -20, center: ['50%', '60%'], radius: '85%',
      min: 0, max, progress: { show: true, width: 8, itemStyle: { color } },
      axisLine: { lineStyle: { width: 8, color: [[value / max, color], [1, '#333']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { offsetCenter: [0, '55%'], valueAnimation: true, formatter: '{value}%', fontSize: 16, color: 'var(--text-primary)' },
      data: [{ value: Math.round(value * 100) / 100, name }],
    }],
  });

  const strategyCols: ColumnsType<StrategyRisk> = [
    { title: '策略', dataIndex: 'strategyName', render: (v: string) => <a style={{ color: 'var(--gold)' }}>{v}</a> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <StatusTag status={v} statusMap={{ draft: { label: '草稿', color: 'default' }, live: { label: '实盘', color: 'green' }, simulating: { label: '模拟', color: 'blue' }, paused: { label: '暂停', color: 'warning' }, archived: { label: '归档', color: 'default' } } as Record<string, { label: string; color: string }>} /> },
    { title: '今日盈亏', dataIndex: 'todayPnl', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>${v.toFixed(2)}</span> },
    { title: '日亏损上限', dataIndex: 'dailyLossLimit', render: (v: number) => `$${v.toLocaleString()}` },
    { title: '已用/上限', render: (_: unknown, r: StrategyRisk) => <span style={{ color: r.dailyLossUsed > r.dailyLossLimit * 0.8 ? 'var(--red-trade)' : 'var(--text-secondary)' }}>${r.dailyLossUsed} / ${r.dailyLossLimit}</span> },
    { title: '连续亏损', render: (_: unknown, r: StrategyRisk) => <span style={{ color: r.consecutiveLosses >= r.maxConsecutiveLosses ? 'var(--red-trade)' : 'var(--text-primary)' }}>{r.consecutiveLosses}/{r.maxConsecutiveLosses}</span> },
    { title: '操作', width: 100, render: (_: unknown, r: StrategyRisk) => (
      <Space size="small">
        <Button size="small" danger={r.status === 'live'} icon={r.status === 'live' ? <StopOutlined /> : undefined} onClick={() => message.info(r.status === 'live' ? '策略已暂停' : '操作完成')}>{r.status === 'live' ? '暂停' : '恢复'}</Button>
      </Space>
    )},
  ];

  const posCols: ColumnsType<Position> = [
    { title: '交易对', dataIndex: 'symbol', width: 110 },
    { title: '方向', dataIndex: 'side', width: 70, render: (v: string) => <Tag color={v === 'long' ? 'green' : 'red'}>{v === 'long' ? '做多' : '做空'}</Tag> },
    { title: '数量', dataIndex: 'quantity' },
    { title: '保证金率', dataIndex: 'marginRatio', render: (v: number) => <span style={{ color: v > 0.7 ? 'var(--red-trade)' : v > 0.4 ? '#FF9800' : 'var(--green-trade)', fontWeight: v > 0.7 ? 'bold' : 'normal' }}>{(v * 100).toFixed(1)}%</span> },
    { title: '距强平%', render: (_: unknown, r: Position) => {
      const dist = r.side === 'long' ? ((r.markPrice - r.liquidationPrice) / r.markPrice * 100) : ((r.liquidationPrice - r.markPrice) / r.markPrice * 100);
      return <span style={{ color: dist < 5 ? 'var(--red-trade)' : dist < 15 ? '#FF9800' : 'var(--green-trade)', fontWeight: dist < 10 ? 'bold' : 'normal' }}>{dist.toFixed(1)}%</span>;
    }},
    { title: '止损价', render: (_: unknown, r: Position) => r.stopLoss ? `$${r.stopLoss.toLocaleString()}` : <Tag>未设置</Tag> },
    { title: '止盈价', render: (_: unknown, r: Position) => r.takeProfit ? `$${r.takeProfit.toLocaleString()}` : <Tag>未设置</Tag> },
    { title: '风险', dataIndex: 'riskLevel', width: 80, render: (v: string) => <Tag color={v === 'danger' ? 'red' : v === 'warning' ? 'orange' : 'green'}>{v === 'danger' ? '危险' : v === 'warning' ? '警告' : '安全'}</Tag> },
  ];

  if (loading || !overview) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>风控面板 — 加载中...</Typography.Title>;
  }

  return (
    <div>
      {/* 熔断横幅 */}
      {meltdown?.isActive && (
        <Alert
          type="error" banner showIcon icon={<WarningOutlined />}
          message={<span>⚠️ <strong>熔断已触发</strong> — {meltdown.reason}，影响策略：{meltdown.affectedStrategies.join(', ')}。冷却至 {meltdown.cooldownEnd ? new Date(meltdown.cooldownEnd).toLocaleString('zh-CN') : '—'}</span>}
          action={<Button danger size="small" icon={<LockOutlined />} onClick={handleRecover}>解除熔断</Button>}
          style={{ marginBottom: 16, border: '2px solid var(--red-trade)', borderRadius: 6 }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>风控面板</Typography.Title>
          <Tag color={overview.riskLevel === 'danger' ? 'red' : overview.riskLevel === 'warning' ? 'orange' : 'green'} icon={<SafetyOutlined />}>
            {overview.riskLevel === 'danger' ? '高风险' : overview.riskLevel === 'warning' ? '警告' : '安全'}
          </Tag>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>刷新</Button>
      </div>

      {/* 概览卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={5}><StatCard title="总敞口" value={overview.totalExposure} format="usdt" /></Col>
        <Col xs={12} sm={8} lg={5}><StatCard title="保证金使用率" value={overview.marginUsageRatio * 100} format="percent" trend={overview.marginUsageRatio > 0.7 ? 'down' : 'up'} /></Col>
        <Col xs={12} sm={8} lg={5}><StatCard title="当前回撤" value={overview.currentDrawdown * 100} format="percent" trend="down" /></Col>
        <Col xs={12} sm={8} lg={5}><StatCard title="活跃告警" value={overview.activeAlerts} format="number" trend={overview.activeAlerts > 0 ? 'down' : 'flat'} /></Col>
      </Row>

      {/* 风控仪表盘（Gauge 图） */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <BaseChart option={gaugeOption(overview.marginUsageRatio * 100, 100, '保证金率', overview.marginUsageRatio > 0.7 ? '#EF5350' : '#F0B90B')} height={220} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <BaseChart option={gaugeOption(overview.currentDrawdown * 100, 50, '最大回撤', overview.currentDrawdown > 0.15 ? '#EF5350' : '#F0B90B')} height={220} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div style={{ padding: 20 }}>
              <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>风控规则配置</Typography.Title>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-secondary)' }}>默认止损: {rules ? (rules.defaultStopLoss * 100).toFixed(0) : '—'}%</span><Slider min={1} max={15} defaultValue={rules?.defaultStopLoss ? rules.defaultStopLoss * 100 : 5} tooltip={{ formatter: (v) => `${v}%` }} /></div>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-secondary)' }}>默认止盈: {rules ? (rules.defaultTakeProfit * 100).toFixed(0) : '—'}%</span><Slider min={5} max={50} defaultValue={rules?.defaultTakeProfit ? rules.defaultTakeProfit * 100 : 15} tooltip={{ formatter: (v) => `${v}%` }} /></div>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-secondary)' }}>日亏损上限</span><InputNumber style={{ width: '100%' }} defaultValue={rules?.dailyLossLimit || 2000} prefix="$" /></div>
              <div style={{ marginBottom: 12 }}><span style={{ color: 'var(--text-secondary)' }}>最大杠杆</span><Select defaultValue={rules?.maxLeverage || 10} style={{ width: '100%' }} options={[1, 2, 3, 5, 10, 20, 50, 100].map((v) => ({ value: v, label: `${v}x` }))} /></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>最大回撤限制</span><InputNumber style={{ width: '100%' }} defaultValue={rules?.maxDrawdownLimit ? rules.maxDrawdownLimit * 100 : 25} suffix="%" /></div>
              <Divider />
              <Button type="primary" block onClick={() => message.success('风控规则已保存')}>保存规则</Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 策略风控表 — 带聚合汇总行 */}
      <Card title="策略风控" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table
          columns={strategyCols} dataSource={strategies} rowKey="strategyId" pagination={false} size="middle" scroll={{ x: 900 }}
          summary={() => {
            const totalPnl = strategies.reduce((s, r) => s + r.todayPnl, 0);
            const totalLossUsed = strategies.reduce((s, r) => s + r.dailyLossUsed, 0);
            const riskLevel: string = totalPnl < -500 ? '⚠️ 高危' : totalPnl < 0 ? '⚡ 警告' : '✅ 正常';
            return (
              <Table.Summary.Row style={{ background: totalPnl < 0 ? 'rgba(239,83,80,0.08)' : 'rgba(38,166,154,0.08)' }}>
                <Table.Summary.Cell index={0}><strong>汇总</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} /><Table.Summary.Cell index={2}>
                  <span style={{ color: totalPnl >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>${totalPnl.toFixed(2)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} /><Table.Summary.Cell index={4}><span style={{ color: 'var(--text-secondary)' }}>${totalLossUsed.toFixed(2)}</span></Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={2}><Tag color={totalPnl < -500 ? 'red' : totalPnl < 0 ? 'orange' : 'green'}>{riskLevel}</Tag></Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      {/* 持仓风险明细 */}
      <Card title="持仓风险明细" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table columns={posCols} dataSource={positions} rowKey="id" pagination={false} size="middle" scroll={{ x: 900 }} />
      </Card>

      {/* 事件日志 */}
      <Card title={`风控事件 (${events.length})`} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        <Table
          columns={[
            { title: '时间', dataIndex: 'time', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
            { title: '类型', dataIndex: 'type', width: 100, render: (v: string) => <Tag color={v === 'meltdown' || v === 'liquidation_warning' ? 'red' : v === 'margin_call' ? 'orange' : v === 'stop_loss' ? 'gold' : 'blue'}>{v.replace('_', ' ')}</Tag> },
            { title: '消息', dataIndex: 'message' },
          ] as ColumnsType<RiskEvent>}
          dataSource={events} rowKey="id" pagination={false} size="middle"
        />
      </Card>
    </div>
  );
}
