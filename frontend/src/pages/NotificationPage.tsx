import { useState, useEffect } from 'react';
import { Typography, Card, Table, Button, Space, Tag, Select, Tabs, Switch, Modal, message, Row, Col } from 'antd';
import { CheckOutlined, DeleteOutlined, ReloadOutlined, SettingOutlined, BellOutlined } from '@ant-design/icons';
import { mockNotifications, mockNotificationPreferences, mockDelay } from '@/lib/mock';
import EmptyState from '@/components/ui/EmptyState';
import type { Notification, NotificationPreference } from '@/lib/types';
import type { ColumnsType } from 'antd/es/table';

export default function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>();
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    Promise.all([mockDelay(mockNotifications(), 300), mockDelay(mockNotificationPreferences(), 200)])
      .then(([n, p]) => { setNotifications(n); setPrefs(p); setLoading(false); });
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    message.success('已标记全部已读');
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    message.success('已删除');
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab !== 'all') return n.type === activeTab;
    if (filter && n.type !== filter) return false;
    return true;
  });

  const cols: ColumnsType<Notification> = [
    {
      title: '', dataIndex: 'read', width: 40, render: (v: boolean) => !v ? <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#F0B90B' }} /> : null,
    },
    { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => <Tag color={v === 'alert' ? 'red' : v === 'trade' ? 'green' : v === 'system' ? 'blue' : 'default'}>{v === 'alert' ? '告警' : v === 'trade' ? '交易' : v === 'system' ? '系统' : '数据'}</Tag> },
    { title: '标题', dataIndex: 'title', render: (v: string, r: Notification) => <span style={{ color: 'var(--text-primary)', fontWeight: r.read ? 'normal' : 'bold' }}>{v}</span> },
    { title: '摘要', dataIndex: 'summary', render: (v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{v}</span> },
    { title: '时间', dataIndex: 'time', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '操作', width: 120, render: (_: unknown, r: Notification) => (
      <Space size="small">
        {r.actions?.map((a) => <Button key={a.action} type="link" size="small" onClick={() => message.info(`${a.label} 将在后续实现`)}>{a.label}</Button>)}
        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteNotification(r.id)} />
      </Space>
    )},
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>通知中心</Typography.Title>
          {unreadCount > 0 && <Tag color="gold">{unreadCount} 条未读</Tag>}
        </Space>
        <Space>
          <Button icon={<CheckOutlined />} onClick={markAllRead} disabled={unreadCount === 0}>全部已读</Button>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button icon={<SettingOutlined />} onClick={() => setActiveTab('prefs')}>偏好设置</Button>
        </Space>
      </div>

      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'all', label: `全部 (${notifications.length})` },
          { key: 'unread', label: `未读 (${unreadCount})` },
          { key: 'alert', label: '告警' },
          { key: 'system', label: '系统' },
          { key: 'trade', label: '交易' },
          { key: 'prefs', label: '偏好设置' },
        ]} />

        {activeTab !== 'prefs' ? (
          filtered.length === 0 ? (
            <EmptyState title="暂无通知" description={activeTab === 'unread' ? '所有通知已读' : '暂无此类通知'} />
          ) : (
            <Table columns={cols} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} size="middle" />
          )
        ) : (
          <div style={{ padding: '16px 0' }}>
            <Typography.Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>通知偏好设置</Typography.Title>
            {prefs.map((pref) => (
              <Row key={pref.type} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }} align="middle">
                <Col xs={6} md={4}>
                  <Tag color={pref.type === 'alert' ? 'red' : pref.type === 'trade' ? 'green' : pref.type === 'system' ? 'blue' : 'default'} style={{ fontSize: 13 }}>
                    {pref.type === 'alert' ? '告警' : pref.type === 'trade' ? '交易' : pref.type === 'system' ? '系统' : '数据'}
                  </Tag>
                </Col>
                <Col xs={8} md={6}><Switch checked={pref.enabled} onChange={() => message.info('偏好将在后续实现')} checkedChildren="启用" unCheckedChildren="关闭" /></Col>
                <Col xs={10} md={14}>
                  <Space wrap>
                    {(['site', 'email', 'telegram', 'discord', 'dingtalk'] as const).map((ch) => (
                      <Tag.CheckableTag key={ch} checked={pref.channels.includes(ch)} onChange={() => message.info('频道配置将在后续实现')}
                        style={{ padding: '2px 10px', border: '1px solid var(--border-color)' }}>
                        {ch === 'site' ? '站内' : ch === 'email' ? '邮件' : ch === 'telegram' ? 'Telegram' : ch === 'discord' ? 'Discord' : '钉钉'}
                      </Tag.CheckableTag>
                    ))}
                  </Space>
                </Col>
              </Row>
            ))}
            <Button type="primary" style={{ marginTop: 16 }} onClick={() => message.success('偏好已保存')}>保存偏好</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
