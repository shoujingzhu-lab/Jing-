import { useParams, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Tag, Button, Descriptions, Table, Tabs, Timeline, Space, message } from 'antd';
import { EditOutlined, BarChartOutlined, PlayCircleOutlined, ThunderboltOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import StatusTag from '@/components/ui/StatusTag';
import StatCard from '@/components/ui/StatCard';
import { STRATEGY_STATUS_MAP } from '@/lib/constants';
import { formatPercent, formatTime } from '@/lib/utils/format';
import type { Strategy, StrategyVersion } from '@/lib/types';

const MOCK_STRATEGY: Strategy = {
  id: 'stg1', name: '均线交叉策略', description: '基于 EMA 快慢线交叉的经典趋势策略，配合成交量确认信号', type: 'visual', status: 'live',
  symbols: ['BTC/USDT', 'ETH/USDT'], exchange: 'binance', createdAt: '2026-03-15', updatedAt: '2026-06-05', version: 3, runningDays: 45,
  tags: ['趋势', 'EMA'],
  lastBacktest: { id: 'bt1', totalReturn: 32.5, sharpeRatio: 1.8, maxDrawdown: -12.3, completedAt: '2026-05-20' },
};

const MOCK_VERSIONS: StrategyVersion[] = [
  { version: 3, timestamp: '2026-06-05 10:30:00', author: 'Demo User', summary: '调整 EMA 参数 (20→50)', tags: ['参数调整'] },
  { version: 2, timestamp: '2026-04-20 14:15:00', author: 'Demo User', summary: '添加成交量过滤节点', tags: ['新增节点'] },
  { version: 1, timestamp: '2026-03-15 09:00:00', author: 'Demo User', summary: '初始创建', tags: ['初始化'] },
];

const BACKTEST_RECORDS = [
  { id: 'bt1', symbols: 'BTC/USDT', period: '2026-01-01 ~ 2026-05-01', status: 'completed', totalReturn: 32.5, sharpeRatio: 1.8, maxDrawdown: -12.3, completedAt: '2026-05-20' },
  { id: 'bt2', symbols: 'BTC/USDT', period: '2026-01-01 ~ 2026-04-01', status: 'completed', totalReturn: 28.1, sharpeRatio: 1.6, maxDrawdown: -14.1, completedAt: '2026-04-15' },
];

export default function StrategyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const strategy = MOCK_STRATEGY;
  const statusConf = STRATEGY_STATUS_MAP[strategy.status];

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
                    <Descriptions.Item label="运行交易对">{strategy.symbols.join(', ')}</Descriptions.Item>
                    <Descriptions.Item label="交易所">{strategy.exchange.toUpperCase()}</Descriptions.Item>
                    <Descriptions.Item label="当前版本">v{strategy.version}</Descriptions.Item>
                    <Descriptions.Item label="运行天数">{strategy.runningDays} 天</Descriptions.Item>
                    <Descriptions.Item label="创建时间">{formatTime(strategy.createdAt)}</Descriptions.Item>
                    <Descriptions.Item label="最后更新">{formatTime(strategy.updatedAt)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card title="最近回测" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  {strategy.lastBacktest ? (
                    <div>
                      <Row gutter={[8, 12]}>
                        <Col span={12}><StatCard title="收益率" value={`${strategy.lastBacktest.totalReturn >= 0 ? '+' : ''}${strategy.lastBacktest.totalReturn.toFixed(1)}%`}
                          trend={strategy.lastBacktest.totalReturn >= 0 ? 'up' : 'down'} style={{ border: 'none', background: 'var(--bg-tertiary)' }} /></Col>
                        <Col span={12}><StatCard title="夏普比率" value={strategy.lastBacktest.sharpeRatio.toFixed(2)} style={{ border: 'none', background: 'var(--bg-tertiary)' }} /></Col>
                        <Col span={12}><StatCard title="最大回撤" value={`${strategy.lastBacktest.maxDrawdown.toFixed(1)}%`} trend="down" style={{ border: 'none', background: 'var(--bg-tertiary)' }} /></Col>
                      </Row>
                    </div>
                  ) : <Typography.Text style={{ color: 'var(--text-secondary)' }}>暂无回测记录</Typography.Text>}
                </Card>
              </Col>
              {/* 回测记录 */}
              <Col span={24}>
                <Card title="回测历史" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <Table dataSource={BACKTEST_RECORDS} rowKey="id" size="small" pagination={false}
                    onRow={(r) => ({ onClick: () => navigate(`/backtest/${r.id}`), style: { cursor: 'pointer' } })}
                    columns={[
                      { title: '交易对', dataIndex: 'symbols' },
                      { title: '回测期间', dataIndex: 'period' },
                      { title: '收益率', dataIndex: 'totalReturn', render: (v: number) => <span style={{ color: v >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600 }}>{formatPercent(v)}</span> },
                      { title: '夏普', dataIndex: 'sharpeRatio' },
                      { title: '回撤', dataIndex: 'maxDrawdown', render: (v: number) => <span style={{ color: 'var(--red-trade)' }}>{v.toFixed(1)}%</span> },
                      { title: '完成时间', dataIndex: 'completedAt' },
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
              <Timeline items={MOCK_VERSIONS.map((v) => ({
                color: v.version === strategy.version ? 'green' : 'gray',
                children: (
                  <div key={v.version}>
                    <Typography.Text strong style={{ color: 'var(--text-primary)' }}>v{v.version}</Typography.Text>
                    {v.version === strategy.version && <Tag color="green" style={{ marginLeft: 8 }}>当前</Tag>}
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
