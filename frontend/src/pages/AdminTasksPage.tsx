import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Switch, message, Tooltip } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { adminApi } from '@/lib/api';
import StatusTag from '@/components/ui/StatusTag';
import type { SystemTask } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<SystemTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminApi.getConfig();
        const config = (res.data as unknown as { data: Record<string, unknown> })?.data
          || (res.data as unknown as Record<string, unknown>);
        // 从系统配置中构建任务列表（如果后端有此数据）
        if (config && config.tasks) {
          setTasks(config.tasks as SystemTask[]);
        }
      } catch {
        // 后端未启动时为空
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const triggerTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t?.status === 'running') { message.warning('任务已在运行中'); return; }
    message.success('任务已触发');
  };

  const toggleTask = (id: string, enabled: boolean) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: enabled ? 'running' as const : 'paused' as const } : t));
    message.success(enabled ? '任务已启用' : '任务已暂停');
  };

  const cols: ColumnsType<SystemTask> = [
    { title: '任务名称', dataIndex: 'name', render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span> },
    { title: '描述', dataIndex: 'description', render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{v}</span> },
    { title: 'Cron', dataIndex: 'cronExpression', width: 110, render: (v: string) => <code style={{ fontSize: 12, background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
    { title: '上次运行', dataIndex: 'lastRunTime', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : <span style={{ color: 'var(--text-secondary)' }}>-</span> },
    { title: '耗时', dataIndex: 'lastDuration', width: 80, render: (v?: number) => v ? `${v}s` : '-' },
    { title: '下次运行', dataIndex: 'nextRunTime', width: 160, render: (v?: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <StatusTag status={v} statusMap={{ running: { label: '运行中', color: 'green' }, paused: { label: '已暂停', color: 'warning' }, failed: { label: '失败', color: 'error' } } as Record<string, { label: string; color: string }>} /> },
    {
      title: '操作', width: 120, render: (_: unknown, r: SystemTask) => (
        <Space size="small">
          <Tooltip title="手动触发">
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => triggerTask(r.id)} />
          </Tooltip>
          <Switch size="small" checked={r.status === 'running'} onChange={(chk) => toggleTask(r.id, chk)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>定时任务管理</Typography.Title>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Table columns={cols} dataSource={tasks} rowKey="id" loading={loading} pagination={false} size="middle" scroll={{ x: 1000 }} />
      </Card>
    </div>
  );
}
