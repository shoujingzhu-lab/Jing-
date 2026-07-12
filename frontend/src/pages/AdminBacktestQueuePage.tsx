import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, InputNumber, Tag, Space, message, Tooltip } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { mockBacktestQueue, mockDelay } from '@/lib/mock';
import StatusTag from '@/components/ui/StatusTag';
import type { BacktestQueueItem } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function AdminBacktestQueuePage() {
  const [queue, setQueue] = useState<BacktestQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { mockDelay(mockBacktestQueue(), 400).then((q) => { setQueue(q); setLoading(false); }); }, []);

  const updatePriority = (id: string, p: number) => {
    setQueue((prev) => prev.map((q) => q.id === id ? { ...q, priority: p } : q));
    message.success('优先级已更新');
  };

  const forceCancel = (id: string) => {
    setQueue((prev) => prev.map((q) => q.id === id ? { ...q, status: 'cancelled' } : q));
    message.success('已强制取消');
  };

  const cols: ColumnsType<BacktestQueueItem> = [
    { title: '用户', dataIndex: 'userName', width: 100 },
    { title: '策略', dataIndex: 'strategyName' },
    { title: '参数', dataIndex: 'params', render: (v: string) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>, width: 200 },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '排队时间', dataIndex: 'queueTime', width: 100 },
    { title: '预计耗时', dataIndex: 'estimatedDuration', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag status={v} statusMap={{ running: { label: '运行中', color: 'processing' }, queued: { label: '排队中', color: 'default' }, completed: { label: '已完成', color: 'success' }, cancelled: { label: '已取消', color: 'warning' } } as Record<string, { label: string; color: string }>} /> },
    { title: '优先级', dataIndex: 'priority', width: 100, render: (v: number, r: BacktestQueueItem) => (
      <Space size="small">
        <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={v >= 10} onClick={() => updatePriority(r.id, v + 1)} />
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
        <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={v <= 1} onClick={() => updatePriority(r.id, v - 1)} />
      </Space>
    )},
    {
      title: '操作', width: 80, render: (_: unknown, r: BacktestQueueItem) => (
        <Tooltip title="强制取消"><Button size="small" danger icon={<CloseCircleOutlined />} disabled={r.status !== 'running' && r.status !== 'queued'} onClick={() => forceCancel(r.id)} /></Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>回测队列管理</Typography.Title>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Table columns={cols} dataSource={queue} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1100 }} />
      </Card>
    </div>
  );
}
