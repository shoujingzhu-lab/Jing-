import { useState } from 'react';
import { Typography, Card, Tabs, Form, Input, Button, Switch, Select, Table, Tag, Divider, message, Row, Col } from 'antd';
import { SaveOutlined, LockOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const MOCK_SESSIONS = [
  { id: 's1', device: 'Chrome / Windows', ip: '192.168.1.100', location: '杭州，中国', lastActive: '2026-06-07T10:00:00Z', isCurrent: true },
  { id: 's2', device: 'Safari / MacOS', ip: '192.168.1.101', location: '杭州，中国', lastActive: '2026-06-06T18:30:00Z', isCurrent: false },
];
const LOGIN_HISTORY = [
  { id: 'h1', ip: '192.168.1.100', location: '杭州，中国', device: 'Chrome / Windows', time: '2026-06-07T10:00:00Z', success: true },
  { id: 'h2', ip: '10.0.0.55', location: '未知', device: 'Firefox / Linux', time: '2026-06-06T22:15:00Z', success: false },
  { id: 'h3', ip: '192.168.1.100', location: '杭州，中国', device: 'Chrome / Windows', time: '2026-06-06T08:00:00Z', success: true },
];

export default function SettingsPage() {
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const handleUpdateProfile = () => {
    profileForm.validateFields().then(() => message.success('个人资料已更新'));
  };
  const handleChangePassword = () => {
    pwdForm.validateFields().then(() => message.success('密码已修改'));
  };

  const sessionCols: ColumnsType<typeof MOCK_SESSIONS[0]> = [
    { title: '设备', dataIndex: 'device' },
    { title: 'IP', dataIndex: 'ip', render: (v: string) => <code>{v}</code> },
    { title: '位置', dataIndex: 'location' },
    { title: '最近活跃', dataIndex: 'lastActive', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '当前', dataIndex: 'isCurrent', width: 80, render: (v: boolean) => v ? <Tag color="green">当前</Tag> : <Button size="small" danger onClick={() => message.success('会话已注销')}>注销</Button> },
  ];

  const loginCols: ColumnsType<typeof LOGIN_HISTORY[0]> = [
    { title: '时间', dataIndex: 'time', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: 'IP', dataIndex: 'ip', render: (v: string) => <code>{v}</code> },
    { title: '位置', dataIndex: 'location' },
    { title: '设备', dataIndex: 'device' },
    { title: '结果', dataIndex: 'success', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '成功' : '失败'}</Tag> },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>账户设置</Typography.Title>

      <Tabs defaultActiveKey="profile" items={[
        {
          key: 'profile', label: <span><UserOutlined /> 个人资料</span>, children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Form form={profileForm} layout="vertical" initialValues={{ nickname: 'Demo User', email: 'demo@quant.com' }} style={{ maxWidth: 480 }}>
                <Form.Item name="nickname" label="昵称" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="email" label="邮箱" rules={[{ required: true }]}><Input disabled /></Form.Item>
                <Form.Item name="phone" label="手机号"><Input placeholder="选填" /></Form.Item>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleUpdateProfile}>保存修改</Button>
              </Form>
            </Card>
          ),
        },
        {
          key: 'password', label: <span><LockOutlined /> 密码修改</span>, children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Form form={pwdForm} layout="vertical" style={{ maxWidth: 400 }}>
                <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
                <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
                <Form.Item name="confirmPassword" label="确认新密码" rules={[{ required: true }]}><Input.Password /></Form.Item>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleChangePassword}>修改密码</Button>
              </Form>
            </Card>
          ),
        },
        {
          key: '2fa', label: '两步验证', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Row align="middle" gutter={16}>
                <Col><Typography.Text strong style={{ color: 'var(--text-primary)' }}>双因素认证 (2FA)</Typography.Text></Col>
                <Col><Switch defaultChecked /></Col>
              </Row>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>已启用 TOTP 验证器（Google Authenticator / Authy）</div>
              <Divider />
              <Button onClick={() => message.info('2FA 重设流程将在后续实现')}>重新配置 2FA</Button>
            </Card>
          ),
        },
        {
          key: 'sessions', label: '会话管理', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Table columns={sessionCols} dataSource={MOCK_SESSIONS} rowKey="id" pagination={false} size="middle" />
              <Divider />
              <Button danger icon={<LogoutOutlined />} onClick={() => message.success('所有其他会话已注销')}>注销其他会话</Button>
            </Card>
          ),
        },
        {
          key: 'login-history', label: '登录历史', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Table columns={loginCols} dataSource={LOGIN_HISTORY} rowKey="id" pagination={{ pageSize: 10 }} size="middle" />
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
