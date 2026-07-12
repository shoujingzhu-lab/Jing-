import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Select, Space, Row, Col, Card, Tag, Dropdown, Table, message } from 'antd';
import { PlusOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, EditOutlined, BarChartOutlined, PlayCircleOutlined, ThunderboltOutlined, MoreOutlined, DeleteOutlined, PauseCircleOutlined } from '@ant-design/icons';
import EmptyState from '@/components/ui/EmptyState';
import StatusTag from '@/components/ui/StatusTag';
import { STRATEGY_STATUS_MAP } from '@/lib/constants';
import { formatPercent } from '@/lib/utils/format';
import type { Strategy, StrategyStatus } from '@/lib/types';

const MOCK: Strategy[] = [
  { id: 'stg1', name: '均线交叉策略', type: 'visual', status: 'live', symbols: ['BTC/USDT'], exchange: 'binance', createdAt: '2026-03-15', updatedAt: '2026-06-05', version: 3, runningDays: 45, tags: ['趋势'], lastBacktest: { id: 'bt1', totalReturn: 32.5, sharpeRatio: 1.8, maxDrawdown: -12.3, completedAt: '2026-05-20' } },
  { id: 'stg2', name: '网格震荡策略', type: 'visual', status: 'live', symbols: ['ETH/USDT'], exchange: 'okx', createdAt: '2026-04-01', updatedAt: '2026-06-01', version: 5, runningDays: 30, tags: ['震荡'], lastBacktest: { id: 'bt2', totalReturn: 18.2, sharpeRatio: 1.5, maxDrawdown: -8.7, completedAt: '2026-05-25' } },
  { id: 'stg3', name: '动量突破策略', type: 'code', status: 'simulating', symbols: ['SOL/USDT'], exchange: 'binance', createdAt: '2026-05-10', updatedAt: '2026-06-06', version: 2, runningDays: 15, tags: ['动量'], lastBacktest: { id: 'bt3', totalReturn: 8.75, sharpeRatio: 1.2, maxDrawdown: -15.1, completedAt: '2026-06-03' } },
  { id: 'stg4', name: 'RSI 反转策略', type: 'visual', status: 'backtesting', symbols: ['BNB/USDT', 'ADA/USDT'], exchange: 'bybit', createdAt: '2026-06-01', updatedAt: '2026-06-06', version: 1, runningDays: 0, tags: ['反转'] },
  { id: 'stg5', name: '做市策略', type: 'code', status: 'draft', symbols: ['BTC/USDT'], exchange: 'binance', createdAt: '2026-06-05', updatedAt: '2026-06-05', version: 1, runningDays: 0, tags: ['做市'] },
  { id: 'stg6', name: '趋势金字塔', type: 'visual', status: 'paused', symbols: ['ETH/USDT'], exchange: 'binance', createdAt: '2026-02-10', updatedAt: '2026-05-30', version: 8, runningDays: 90, tags: ['趋势'], lastBacktest: { id: 'bt4', totalReturn: 45.2, sharpeRatio: 2.1, maxDrawdown: -20.5, completedAt: '2026-04-15' } },
];

export default function StrategyListPage() {
  const navigate = useNavigate();
  const [strategies] = useState(MOCK);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StrategyStatus[]>([]);

  const filtered = strategies.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
    return true;
  });

  const getMenuItems = (s: Strategy) => [
    { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => navigate(s.type === 'visual' ? `/strategy/visual/${s.id}` : `/strategy/code/${s.id}`) },
    { key: 'backtest', icon: <BarChartOutlined />, label: '回测', onClick: () => navigate(`/backtest/new?strategy=${s.id}`) },
    { key: 'sim', icon: <PlayCircleOutlined />, label: '模拟运行', onClick: () => navigate(`/sim?strategy=${s.id}`) },
    { key: 'live', icon: <ThunderboltOutlined />, label: '实盘运行', onClick: () => message.info('请先通过模拟验证') },
    { type: 'divider' as const },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => message.success('已删除') },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>策略管理</Typography.Title>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/strategy/visual/new')}>可视化策略</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/strategy/code/new')}>代码策略</Button>
        </Space>
      </div>

      {/* 工具栏 */}
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between', display: 'flex' }}>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="搜索策略..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} allowClear />
          <Select mode="multiple" placeholder="状态筛选" value={statusFilter} onChange={setStatusFilter} style={{ minWidth: 160 }}
            options={Object.entries(STRATEGY_STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
        </Space>
        <Space>
          <Button type={viewMode === 'grid' ? 'primary' : 'default'} icon={<AppstoreOutlined />} onClick={() => setViewMode('grid')} />
          <Button type={viewMode === 'table' ? 'primary' : 'default'} icon={<UnorderedListOutlined />} onClick={() => setViewMode('table')} />
        </Space>
      </Space>

      {filtered.length === 0 ? (
        <EmptyState title="还没有策略" description="创建你的第一个量化策略" actionText="创建策略" onAction={() => navigate('/strategy/visual/new')} />
      ) : viewMode === 'grid' ? (
        <Row gutter={[16, 16]}>
          {filtered.map((s) => {
            const statusConf = STRATEGY_STATUS_MAP[s.status];
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={s.id}>
                <Card hoverable size="small" onClick={() => navigate(`/strategy/${s.id}/detail`)}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', height: '100%' }}
                  styles={{ body: { padding: 16 } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text strong style={{ fontSize: 15 }}>{s.name}</Typography.Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color={statusConf.color}>{statusConf.label}</Tag>
                        <Tag>{s.type === 'visual' ? '🎨 可视化' : '💻 代码'}</Tag>
                      </div>
                    </div>
                    <Dropdown menu={{ items: getMenuItems(s) }} trigger={['click']}>
                      <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                    </Dropdown>
                  </div>
                  {s.lastBacktest && (
                    <div style={{ marginTop: 12, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 12 }}>
                      <Row gutter={8}>
                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>收益率</span><br /><span style={{ color: s.lastBacktest.totalReturn >= 0 ? 'var(--green-trade)' : 'var(--red-trade)', fontWeight: 600 }}>{s.lastBacktest.totalReturn >= 0 ? '+' : ''}{s.lastBacktest.totalReturn.toFixed(1)}%</span></Col>
                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>夏普</span><br /><span style={{ fontWeight: 600 }}>{s.lastBacktest.sharpeRatio.toFixed(2)}</span></Col>
                        <Col span={8}><span style={{ color: 'var(--text-secondary)' }}>回撤</span><br /><span style={{ color: 'var(--red-trade)' }}>{s.lastBacktest.maxDrawdown.toFixed(1)}%</span></Col>
                      </Row>
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {s.symbols.join(', ')} · 运行 {s.runningDays} 天
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Table<Strategy> dataSource={filtered} rowKey="id" size="middle" pagination={{ pageSize: 20 }}
          onRow={(r) => ({ onClick: () => navigate(`/strategy/${r.id}/detail`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '策略名', dataIndex: 'name', render: (n: string, r: Strategy) => <a>{n}</a> },
            { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => <Tag>{t === 'visual' ? '可视化' : '代码'}</Tag> },
            { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <StatusTag status={s} label={STRATEGY_STATUS_MAP[s]?.label || s} /> },
            { title: '交易对', dataIndex: 'symbols', width: 180, render: (ss: string[]) => ss.join(', ') },
            { title: '回测收益', key: 'bt', width: 100, render: (_: unknown, r: Strategy) => r.lastBacktest ? <span style={{ color: r.lastBacktest.totalReturn >= 0 ? 'var(--green-trade)' : 'var(--red-trade)' }}>{formatPercent(r.lastBacktest.totalReturn)}</span> : '--' },
            { title: '运行天数', dataIndex: 'runningDays', width: 80 },
            { title: '版本', dataIndex: 'version', width: 60, render: (v: number) => `v${v}` },
            { title: '更新', dataIndex: 'updatedAt', width: 100, render: (d: string) => new Date(d).toLocaleDateString() },
          ]}
        />
      )}
    </div>
  );
}
