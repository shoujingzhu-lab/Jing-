import { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Input, Select, Button, Space, Table, Dropdown, Progress, message } from 'antd';
import { SearchOutlined, PlusOutlined, MoreOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { backtestApi } from '@/lib/api';
import { BACKTEST_STATUS_MAP } from '@/lib/constants';
import StatusTag from '@/components/ui/StatusTag';
import EmptyState from '@/components/ui/EmptyState';
import type { BacktestTask } from '@/lib/types';

export default function BacktestListPage() {
  const [tasks, setTasks] = useState<BacktestTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await backtestApi.getList();
      const data = (res.data as unknown as { items?: BacktestTask[] })?.items
        || (res.data as unknown as BacktestTask[]) || [];
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      message.error('加载回测任务失败，请确认后端服务已启动');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (search && !t.strategyName.toLowerCase().includes(search.toLowerCase()) && !t.symbols.join(' ').toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(t.status)) return false;
      return true;
    });
  }, [tasks, search, statusFilter]);

  const statusDropdown = (r: BacktestTask) => (
    <Dropdown menu={{ items: [
      { key: 'report', icon: <BarChartOutlined />, label: '查看报告', disabled: r.status !== 'completed', onClick: () => navigate(`/backtest/${r.id}`) },
      { key: 'rerun', icon: <PlayCircleOutlined />, label: '重新运行', onClick: () => message.info('已加入回测队列') },
      { key: 'cancel', icon: <StopOutlined />, label: '取消', disabled: r.status !== 'running' && r.status !== 'queued', onClick: async () => { try { await backtestApi.cancel(r.id); message.success('任务已取消'); loadData(); } catch { message.error('取消失败'); } } },
      { type: 'divider' },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: async () => { try { await backtestApi.cancel(r.id); setTasks((p) => p.filter((x) => x.id !== r.id)); message.success('已删除'); } catch { message.error('删除失败'); } } },
    ]}}>
      <Button type="text" size="small" icon={<MoreOutlined />} />
    </Dropdown>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusMap = BACKTEST_STATUS_MAP as Record<string, { label: string; color: any }>;

  const columns: ColumnsType<BacktestTask> = [
    { title: 'ID', dataIndex: 'id', width: 100, render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: '策略', dataIndex: 'strategyName', render: (v: string) => <a style={{ color: 'var(--gold)' }}>{v}</a> },
    { title: '交易对', dataIndex: 'symbols', render: (v: string[]) => v.join(', ') },
    { title: '周期', dataIndex: 'period', width: 220 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} statusMap={statusMap} /> },
    { title: '进度', dataIndex: 'progress', width: 140, render: (v: number | undefined, r: BacktestTask) =>
      v !== undefined ? <Progress percent={v} size="small" strokeColor={v === 100 ? '#26A69A' : '#F0B90B'} /> : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.status === 'queued' ? '等待中' : r.status === 'failed' ? '失败' : '已取消'}</span> },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作', key: 'actions', width: 60, fixed: 'right', render: (_: unknown, r: BacktestTask) => statusDropdown(r) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>回测中心</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/backtest/new')}>新建回测</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索策略或交易对" prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
          <Select mode="multiple" placeholder="状态筛选" value={statusFilter} onChange={setStatusFilter} style={{ minWidth: 200 }} allowClear options={Object.entries(BACKTEST_STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Button onClick={loadData} loading={loading}>刷新</Button>
        </Space>
      </Card>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        {!loading && filtered.length === 0 ? (
          <EmptyState title="暂无回测任务" description="创建回测来验证策略表现" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/backtest/new')}>新建回测</Button>} />
        ) : (
          <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1050 }} size="middle" />
        )}
      </Card>
    </div>
  );
}
