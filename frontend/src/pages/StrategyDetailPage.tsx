import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Tag, Button, Descriptions, Table, Tabs, Timeline, Space, message } from 'antd';
import { EditOutlined, BarChartOutlined, PlayCircleOutlined, ThunderboltOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import StatusTag from '@/components/ui/StatusTag';
import StatCard from '@/components/ui/StatCard';
import { STRATEGY_STATUS_MAP } from '@/lib/constants';
import { strategyApi, backtestApi } from '@/lib/api';
import { formatPercent, formatTime } from '@/lib/utils/format';
import type { Strategy, StrategyVersion } from '@/lib/types';

export default function StrategyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [backtestRecords, setBacktestRecords] = useState<Array<{ id: string; symbols: string; period: string; status: string; totalReturn: number; sharpeRatio: number; maxDrawdown: number; completedAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [detailRes, versionsRes, backtestRes] = await Promise.allSettled([
          strategyApi.getDetail(id),
          strategyApi.getVersions(id),
          backtestApi.getList({ page_size: 10 }),
        ]);

        if (detailRes.status === 'fulfilled') {
          const s = (detailRes.value.data as unknown as { data: Strategy })?.data
            || (detailRes.value.data as unknown as Strategy);
          setStrategy(s as Strategy);
        }

        if (versionsRes.status === 'fulfilled') {
          const v = (versionsRes.value.data as unknown as { items?: StrategyVersion[] })?.items
            || (versionsRes.value.data as unknown as StrategyVersion[]) || [];
          setVersions(Array.isArray(v) ? v : []);
        }

        if (backtestRes.status === 'fulfilled') {
          const b = (backtestRes.value.data as unknown as { items?: Array<Record<string, unknown>> })?.items || [];
          if (Array.isArray(b)) {
            setBacktestRecords(b.map((r) => ({
              id: r.id as string,
              symbols: (r.symbols as string[])?.join(', ') || (r.symbol as string) || '--',
              period: '--',
              status: r.status as string || 'completed',
              totalReturn: (r.totalReturn ?? r.total_return ?? 0) as number,
              sharpeRatio: (r.sharpeRatio ?? r.sharpe_ratio ?? 0) as number,
              maxDrawdown: (r.maxDrawdown ?? r.max_drawdown ?? 0) as number,
              completedAt: (r.completedAt ?? r.completed_at ?? r.createdAt ?? '') as string,
            })));
          }
        }
      } catch {
        message.error('加载策略详情失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading || !strategy) {
    return <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>策略详情 — 加载中...</Typography.Title>;
  }

  const statusConf = STRATEGY_STATUS_MAP[strategy.status] || { label: strategy.status, color: 'default' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>
            {strategy.name}
          </Typography.Title>
          <Space style={{ marginTop: 8 }}>
            <Tag color={statusConf.color}>{statusConf.label}</Tag>
            <Tag>{strategy.type === 'visual' ? '🎨 可视化' : '💻 代码'}</Tag>
            {strategy.tags?.map((t) => <Tag key={t} color="default">{t}</Tag>)}
          </Space>
        </div>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/strategy/visual/${id}`)}>编辑</Button>
          <Button icon={<BarChartOutlined />} onClick={() => navigate(`/backtest/new?strategy=${id}`)}>回测</Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => navigate(`/sim`)}>模拟</Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => message.warning('请先通过模拟验证')}>实盘</Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="overview" items={[
        {
          key: 'overview', label: '策略概览', children: (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={16}>
                <Card title="基本信息" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="策略名称">{strategy.name}</Descriptions.Item>
                    <Descriptions.Item label="类型">{strategy.type === 'visual' ? '可视化策略' : '代码策略'}</Descriptions.Item>
                    <Descriptions.Item label="运行交易对">{strategy.symbols?.join(', ') || '--'}</Descriptions.Item>
                    <Descriptions.Item label="当前版本">v{strategy.version ?? 1}</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{formatTime(strategy.createdAt)}</Descriptions.Item>
                    <Descriptions.Item label="最后更新">{formatTime(strategy.updatedAt)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card title="策略状态" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <Row gutter={[8, 12]}>
                    <Col span={12}><StatCard title="当前版本" value={`v${strategy.version ?? 1}`} style={{ border: 'none', background: 'var(--bg-tertiary)' }} /></Col>
                    <Col span={12}><StatCard title="状态" value={statusConf.label} style={{ border: 'none', background: 'var(--bg-tertiary)' }} /></Col>
                  </Row>
                </Card>
              </Col>
              {/* 回测记录 */}
              <Col span={24}>
                <Card title="回测历史" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <Table dataSource={backtestRecords} rowKey="id" size="small" loading={loading} pagination={false}
                    onRow={(r) => ({ onClick: () => navigate(`/backtest/${r.id}`), style: { cursor: 'pointer' } })}
                    columns={[
                      { title: '交易对', dataIndex: 'symbols' },
                      { title: '回测期间', dataIndex: 'period' },
                      { title: '收益率', dataIndex: 'totalReturn', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600 }}>{formatPercent(v)}</span> },
                      { title: '夏普', dataIndex: 'sharpeRatio', render: (v: number) => (v ?? 0).toFixed(2) },
                      { title: '回撤', dataIndex: 'maxDrawdown', render: (v: number) => <span style={{ color: 'var(--red-trade)' }}>{(v ?? 0).toFixed(1)}%</span> },
                      { title: '完成时间', dataIndex: 'completedAt', render: (v: string) => v ? formatTime(v) : '--' },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: 'versions', label: '版本历史', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              {versions.length > 0 ? (
                <Timeline items={versions.map((v) => ({
                  color: v.version === (strategy.version ?? 1) ? 'green' : 'gray',
                  children: (
                    <div key={v.version}>
                      <Typography.Text strong style={{ color: 'var(--text-primary)' }}>v{v.version}</Typography.Text>
                      {v.version === (strategy.version ?? 1) && <Tag color="green" style={{ marginLeft: 8 }}>当前</Tag>}
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{v.summary}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                        {v.author} · {formatTime(v.timestamp)}
                      </div>
                      <Space style={{ marginTop: 4 }}>
                        <Button size="small" type="link">查看此版本</Button>
                        <Button size="small" type="link" icon={<RollbackOutlined />} onClick={() => message.success('已回滚')}>回滚</Button>
                      </Space>
                    </div>
                  ),
                }))} />
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无版本历史</div>
              )}
            </Card>
          ),
        },
        {
          key: 'alerts', label: '告警规则', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                🔔 策略告警规则配置面板 — 将在后续阶段详细实现
              </div>
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
