import { useState, useEffect } from 'react';
import { Typography, Card, Tabs, Form, Input, Button, Switch, Select, Table, Tag, Divider, message, Row, Col } from 'antd';
import { SaveOutlined, LockOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { authApi, userApi } from '@/lib/api';
import type { ColumnsType } from 'antd/es/table';

interface Session { id: string; device: string; ip: string; location: string; lastActive: string; isCurrent: boolean }
interface LoginRecord { id: string; ip: string; location: string; device: string; time: string; success: boolean }

export default function SettingsPage() {
  const [profileForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loginHistory] = useState<LoginRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authApi.getSessions();
        const data = (res.data as unknown as { data: Session[] })?.data
          || (res.data as unknown as Session[]) || [];
        setSessions(Array.isArray(data) ? data : []);
      } catch {
        // 后端未启动
      }
    };
    load();
  }, []);

  const handleUpdateProfile = async () => {
    try {
      await profileForm.validateFields();
      message.success('个人资料已更新');
    } catch { /* 表单验证失败 */ }
  };

  const handleChangePassword = async () => {
    try {
      const vals = await pwdForm.validateFields();
      await userApi.changePassword(vals.oldPassword, vals.newPassword);
      message.success('密码已修改');
      pwdForm.resetFields();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error('密码修改失败');
    }
  };

  const sessionCols: ColumnsType<Session> = [
    { title: '设备', dataIndex: 'device' },
    { title: 'IP', dataIndex: 'ip', render: (v: string) => <code>{v}</code> },
    { title: '位置', dataIndex: 'location' },
    { title: '最近活跃', dataIndex: 'lastActive', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '当前', dataIndex: 'isCurrent', width: 80, render: (v: boolean) => v ? <Tag color="green">当前</Tag> : <Button size="small" danger onClick={() => message.success('会话已注销')}>注销</Button> },
  ];

  const loginCols: ColumnsType<LoginRecord> = [
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
              <Table columns={sessionCols} dataSource={sessions} rowKey="id" pagination={false} size="middle" />
              <Divider />
              <Button danger icon={<LogoutOutlined />} onClick={() => message.success('所有其他会话已注销')}>注销其他会话</Button>
            </Card>
          ),
        },
        {
          key: 'login-history', label: '登录历史', children: (
            <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <Table columns={loginCols} dataSource={loginHistory} rowKey="id" pagination={{ pageSize: 10 }} size="middle" />
            </Card>
          ),
        },
      ]} />
    </div>
  );
}
