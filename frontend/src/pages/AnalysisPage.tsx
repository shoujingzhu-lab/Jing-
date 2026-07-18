import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Table, Tag, Button, Space, Progress, Collapse, Empty } from 'antd';
import { ReloadOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { aiApi, strategyApi } from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import BaseChart from '@/components/Chart/BaseChart';
import type { StrategyHealth, MarketState, OptimizationSuggestion } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const DIMENSION_LABELS: Record<string, string> = {
  profitability: '盈利能力', risk: '风险控制', stability: '稳定性', overfittingRisk: '抗过拟合', adaptability: '市场适应',
};

export default function AnalysisPage() {
  const [healthList, setHealthList] = useState<StrategyHealth[]>([]);
  const [market, setMarket] = useState<MarketState | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [strategiesRes, marketRes] = await Promise.allSettled([
          strategyApi.getList({ page_size: 50 }),
          aiApi.getMarketState(),
        ]);

        // 从策略列表加载健康度
        const strategies = strategiesRes.status === 'fulfilled'
          ? ((strategiesRes.value.data as unknown as { items?: Array<Record<string, unknown>> })?.items || [])
          : [];

        if (Array.isArray(strategies) && strategies.length > 0) {
          // 为每个策略获取健康度评分
          const healthResults = await Promise.allSettled(
            strategies.slice(0, 5).map((s) =>
              aiApi.getHealthScore(s.id as string).catch(() => null)
            )
          );
          const healthData: StrategyHealth[] = [];
          healthResults.forEach((hr, idx) => {
            if (hr.status === 'fulfilled' && hr.value) {
              const d = (hr.value.data as unknown as { data: StrategyHealth })?.data
                || (hr.value.data as unknown as StrategyHealth);
              if (d) healthData.push(d);
            }
          });
          setHealthList(healthData);
        }

        // 市场状态
        if (marketRes.status === 'fulfilled') {
          const m = (marketRes.value.data as unknown as { data: MarketState })?.data
            || (marketRes.value.data as unknown as MarketState);
          setMarket(m as MarketState);
        }

        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // 雷达图数据
  const radarData = healthList.map((h) => ({
    name: h.strategyName,
    ...Object.fromEntries(Object.entries(h.dimensions).map(([k, v]) => [DIMENSION_LABELS[k] || k, v])),
  }));

  const healthCols: ColumnsType<StrategyHealth> = [
    { title: '策略', dataIndex: 'strategyName', render: (v: string) => <a style={{ color: 'var(--gold)' }} onClick={() => navigate(`/analysis/strategy/${healthList.find((h) => h.strategyName === v)?.strategyId}`)}>{v}</a> },
    { title: '健康度', dataIndex: 'score', width: 120, render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 80 ? '#26A69A' : v >= 60 ? '#FF9800' : '#EF5350'} /> },
    { title: '盈利能力', render: (_: unknown, r: StrategyHealth) => <Progress percent={r.dimensions.profitability} size="small" strokeColor="#F0B90B" /> },
    { title: '风险控制', render: (_: unknown, r: StrategyHealth) => <Progress percent={r.dimensions.risk} size="small" strokeColor={r.dimensions.risk >= 70 ? '#26A69A' : '#FF9800'} /> },
    { title: '稳定性', render: (_: unknown, r: StrategyHealth) => <Progress percent={r.dimensions.stability} size="small" strokeColor="#1890ff" /> },
    { title: '问题', render: (_: unknown, r: StrategyHealth) => r.issues.length === 0 ? <Tag color="green">无问题</Tag> : r.issues.map((issue) => <Tag key={issue} color="warning" style={{ marginBottom: 2 }}>{issue}</Tag>) },
    { title: '操作', width: 80, render: (_: unknown, r: StrategyHealth) => <Button size="small" type="link" onClick={() => navigate(`/analysis/strategy/${r.strategyId}`)}>诊断</Button> },
  ];

  if (loading) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>智能分析 — 加载中...</Typography.Title>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>智能分析</Typography.Title>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>

      {/* 市场状态面板 */}
      {market && (
        <Card title={<span><ThunderboltOutlined /> 市场状态</span>} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12} md={6}>
              <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>当前状态</div>
                <Tag color="gold" style={{ fontSize: 16, marginTop: 8, padding: '2px 12px' }}>{market.currentState}</Tag>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4 }}>置信度: {((market.confidence ?? 0) * 100).toFixed(0)}%</div>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>BTC 占比</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{((market.btcDominance ?? 0) * 100).toFixed(1)}%</div>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>恐惧贪婪</div>
                <div style={{ color: (market.fearGreedIndex ?? 50) < 30 ? '#EF5350' : (market.fearGreedIndex ?? 50) > 70 ? '#26A69A' : 'var(--text-primary)', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{market.fearGreedIndex ?? 50}</div>
              </div>
            </Col>
            <Col xs={12} sm={6} md={4}>
              <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>山寨季指数</div>
                <div style={{ color: (market.altcoinSeasonIndex ?? 50) > 75 ? '#26A69A' : 'var(--text-primary)', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{market.altcoinSeasonIndex ?? 50}</div>
              </div>
            </Col>
          </Row>

          {/* 状态转移概率 */}
          {market.transitionProbabilities && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>市场状态转移概率: </Typography.Text>
              {market.transitionProbabilities.map((tp) => (
                <Tag key={tp.state} color={tp.probability > 0.3 ? 'blue' : 'default'} style={{ marginLeft: 4 }}>
                  {tp.state}: {(tp.probability * 100).toFixed(0)}%
                </Tag>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 策略健康度列表 + 蜘蛛图 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="策略健康度" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {healthList.length > 0 ? (
              <Table columns={healthCols} dataSource={healthList} rowKey="strategyId" pagination={false} size="middle" scroll={{ x: 800 }} />
            ) : (
              <Empty description="暂无策略数据，请先创建策略并进行回测" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="能力雷达图" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            {healthList.length > 0 ? (
              <BaseChart type="radar" data={radarData} xField="name" yField="" height={280} />
            ) : <Empty description="暂无策略数据" />}
          </Card>
        </Col>
      </Row>

      {/* 优化建议 */}
      <Card title={<span><BulbOutlined /> 优化建议</span>} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginTop: 16 }}>
        {suggestions.length === 0 ? (
          <Empty description="暂无优化建议" />
        ) : (
          suggestions.map((sug) => (
            <div key={sug.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
              <Space>
                <Tag color={sug.impact === 'high' ? 'red' : sug.impact === 'medium' ? 'orange' : 'blue'}>{sug.impact === 'high' ? '高' : sug.impact === 'medium' ? '中' : '低'}</Tag>
                <Tag>{sug.type === 'parameter' ? '参数' : sug.type === 'market_adaptation' ? '市场适应' : '风控'}</Tag>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sug.title}</span>
              </Space>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginLeft: 4 }}>{sug.description}</div>
              {sug.currentValue && <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2, marginLeft: 4 }}>当前: {sug.currentValue} → 建议: {sug.suggestedValue}</div>}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
