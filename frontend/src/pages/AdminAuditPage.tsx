import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, DatePicker, Select, Input, Drawer, message } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { mockDelay } from '@/lib/mock';
import type { ColumnsType } from 'antd/es/table';

interface AuditLog { id: string; userId: string; userName: string; action: string; resource: string; detail: string; ip: string; time: string; status: string }

const MOCK_LOGS: AuditLog[] = [
  { id: 'log-001', userId: 'user-001', userName: 'admin', action: '登录', resource: '系统', detail: '管理员登录后台', ip: '192.168.1.100', time: '2026-06-07T10:00:00Z', status: 'success' },
  { id: 'log-002', userId: 'user-002', userName: 'trader1', action: '创建回测', resource: '回测任务', detail: '创建 EMA金叉策略 回测', ip: '192.168.1.101', time: '2026-06-07T09:45:00Z', status: 'success' },
  { id: 'log-003', userId: 'user-005', userName: 'user2', action: '删除策略', resource: '策略', detail: '删除 RSI超卖反弹 策略', ip: '192.168.1.105', time: '2026-06-07T09:30:00Z', status: 'success' },
  { id: 'log-004', userId: 'unknown', userName: '-', action: '登录失败', resource: '认证', detail: '密码错误（第3次）', ip: '10.0.0.55', time: '2026-06-07T09:15:00Z', status: 'failed' },
  { id: 'log-005', userId: 'user-001', userName: 'admin', action: '修改配置', resource: '系统配置', detail: '修改最大用户数为 500', ip: '192.168.1.100', time: '2026-06-07T08:30:00Z', status: 'success' },
  { id: 'log-006', userId: 'user-003', userName: 'reviewer', action: '审核策略', resource: '策略', detail: '审核通过「布林带突破」策略文档', ip: '192.168.1.103', time: '2026-06-07T08:00:00Z', status: 'success' },
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>(MOCK_LOGS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filtered = logs.filter((l) => {
    if (search && !l.userName.includes(search) && !l.detail.includes(search)) return false;
    if (actionFilter.length > 0 && !actionFilter.some((a) => l.action.includes(a))) return false;
    return true;
  });

  const cols: ColumnsType<AuditLog> = [
    { title: '时间', dataIndex: 'time', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '用户', dataIndex: 'userName', width: 100 },
    { title: '操作', dataIndex: 'action', width: 100, render: (v: string) => <Tag color={v.includes('失败') ? 'red' : v.includes('删除') ? 'orange' : 'blue'}>{v}</Tag> },
    { title: '资源', dataIndex: 'resource', width: 100 },
    { title: '详情', dataIndex: 'detail', render: (v: string) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '状态', dataIndex: 'status', width: 70, render: (v: string) => <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag> },
    { title: '操作', width: 60, render: (_: unknown, r: AuditLog) => <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelectedLog(r)} /> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>审计日志</Typography.Title>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索用户或详情" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
          <Select mode="multiple" placeholder="操作类型" value={actionFilter} onChange={setActionFilter} style={{ minWidth: 180 }} allowClear
            options={['登录', '创建回测', '删除策略', '修改配置', '审核策略', '登录失败'].map((v) => ({ value: v, label: v }))} />
          <DatePicker.RangePicker />
        </Space>
      </Card>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }} size="middle" scroll={{ x: 900 }} />
      </Card>
      <Drawer title="审计详情" open={!!selectedLog} onClose={() => setSelectedLog(null)} width={400}>
        {selectedLog && (
          <div>
            <p><strong>ID:</strong> {selectedLog.id}</p>
            <p><strong>用户:</strong> {selectedLog.userName} ({selectedLog.userId})</p>
            <p><strong>操作:</strong> {selectedLog.action}</p>
            <p><strong>资源:</strong> {selectedLog.resource}</p>
            <p><strong>详情:</strong> {selectedLog.detail}</p>
            <p><strong>IP:</strong> {selectedLog.ip}</p>
            <p><strong>时间:</strong> {new Date(selectedLog.time).toLocaleString('zh-CN')}</p>
            <p><strong>状态:</strong> {selectedLog.status}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
