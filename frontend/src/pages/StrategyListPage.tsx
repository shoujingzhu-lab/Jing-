import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Select, Space, Row, Col, Card, Tag, Dropdown, Table, message } from 'antd';
import { PlusOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, EditOutlined, BarChartOutlined, PlayCircleOutlined, ThunderboltOutlined, MoreOutlined, DeleteOutlined } from '@ant-design/icons';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import StatusTag from '@/components/ui/StatusTag';
import { STRATEGY_STATUS_MAP } from '@/lib/constants';
import { formatPercent } from '@/lib/utils/format';
import { useStrategyList, useDeleteStrategy } from '@/features/strategy/hooks/useStrategy';
import type { Strategy, StrategyStatus } from '@/lib/types';

export default function StrategyListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StrategyStatus[]>([]);

  const { data: strategies = [], isLoading, isError, refetch } = useStrategyList();
  const deleteMutation = useDeleteStrategy();

  const filtered = strategies.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
    return true;
  });

  const handleDelete = (s: Strategy) => {
    deleteMutation.mutate(s.id, {
      onSuccess: () => message.success('策略已删除'),
      onError: () => message.error('删除失败'),
    });
  };

  const getMenuItems = (s: Strategy) => [
    { key: 'edit', icon: <EditOutlined />, label: '编辑', onClick: () => navigate(s.type === 'visual' ? `/strategy/visual/${s.id}` : `/strategy/code/${s.id}`) },
    { key: 'backtest', icon: <BarChartOutlined />, label: '回测', onClick: () => navigate(`/backtest/new?strategy=${s.id}`) },
    { key: 'sim', icon: <PlayCircleOutlined />, label: '模拟运行', onClick: () => navigate(`/sim?strategy=${s.id}`) },
    { key: 'live', icon: <ThunderboltOutlined />, label: '实盘运行', onClick: () => message.info('请先通过模拟验证') },
    { type: 'divider' as const },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => handleDelete(s) },
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

      {/* Loading */}
      {isLoading && (
        <Skeleton type="metric-row" rows={6} />
      )}

      {/* Error */}
      {isError && !isLoading && (
        <EmptyState title="加载失败" description="无法获取策略列表，请检查网络连接" actionText="重试" onAction={() => refetch()} />
      )}

      {/* Empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="还没有策略" description="创建你的第一个量化策略" actionText="创建策略" onAction={() => navigate('/strategy/visual/new')} />
      )}

      {/* Grid View */}
      {!isLoading && !isError && filtered.length > 0 && viewMode === 'grid' && (
        <Row gutter={[16, 16]}>
          {filtered.map((s, idx) => {
            const statusConf = STRATEGY_STATUS_MAP[s.status];
            return (
              <Col xs={24} sm={12} lg={8} xl={6} key={s.id}
                style={{ animation: `slide-up 0.3s ease-out both`, animationDelay: `${idx * 50}ms` }}
              >
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate(`/strategy/${s.id}/detail`)}
                  className="card-base card-hover"
                  style={{ height: '100%', transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}
                  styles={{ body: { padding: 16 } }}
                >
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
      )}

      {/* Table View */}
      {!isLoading && !isError && filtered.length > 0 && viewMode === 'table' && (
        <Table<Strategy> dataSource={filtered} rowKey="id" size="middle" pagination={{ pageSize: 20 }}
          onRow={(r) => ({ onClick: () => navigate(`/strategy/${r.id}/detail`), style: { cursor: 'pointer' } })}
          columns={[
            { title: '策略名', dataIndex: 'name', render: (n: string) => <a>{n}</a> },
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
