import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Tag, Space, Select, Input, Modal, message } from 'antd';
import { ReloadOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { mockUsers, mockDelay } from '@/lib/mock';
import type { User, UserRole } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: '普通用户' }, { value: 'advanced_user', label: '高级用户' }, { value: 'strategy_reviewer', label: '策略审核员' }, { value: 'admin', label: '管理员' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole[]>([]);

  useEffect(() => { mockDelay(mockUsers(), 400).then((u) => { setUsers(u); setLoading(false); }); }, []);

  const updateRole = (id: string, role: UserRole) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    message.success('角色已更新');
  };

  const toggleUser = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, /* disabled toggle */ } : u));
    message.success('用户状态已更新');
  };

  const filtered = users.filter((u) => {
    if (search && !u.email.includes(search) && !u.nickname.includes(search)) return false;
    if (roleFilter.length > 0 && !roleFilter.includes(u.role)) return false;
    return true;
  });

  const cols: ColumnsType<User> = [
    { title: '昵称', dataIndex: 'nickname', render: (v: string) => <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v}</span> },
    { title: '邮箱', dataIndex: 'email', render: (v: string) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v}</span> },
    { title: '角色', dataIndex: 'role', width: 160, render: (v: UserRole) => {
      const opt = ROLE_OPTIONS.find((o) => o.value === v);
      return <Tag color={v === 'admin' ? 'red' : v === 'advanced_user' ? 'blue' : v === 'strategy_reviewer' ? 'purple' : 'default'}>{opt?.label}</Tag>;
    }},
    { title: '2FA', dataIndex: 'twoFactorEnabled', width: 60, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '已启用' : '未启用'}</Tag> },
    { title: '注册时间', dataIndex: 'createdAt', width: 170, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    {
      title: '操作', width: 120, render: (_: unknown, r: User) => (
        <Space size="small">
          <Select size="small" value={r.role} onChange={(v) => updateRole(r.id, v)} style={{ width: 100 }} options={ROLE_OPTIONS} />
          <Button size="small" icon={<StopOutlined />} onClick={() => toggleUser(r.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>用户管理</Typography.Title>
        <Button icon={<ReloadOutlined />}>刷新</Button>
      </div>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Space>
          <Input placeholder="搜索用户或邮箱" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
          <Select mode="multiple" placeholder="角色筛选" value={roleFilter} onChange={setRoleFilter} style={{ minWidth: 200 }} allowClear options={ROLE_OPTIONS} />
        </Space>
      </Card>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }} size="middle" />
      </Card>
    </div>
  );
}
