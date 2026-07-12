import { useState } from 'react';
import { Typography, Card, Form, Input, InputNumber, Select, Switch, Button, Divider, message, Space } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';

export default function AdminSystemPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    form.validateFields().then((vals) => {
      setLoading(true);
      setTimeout(() => { setLoading(false); message.success('系统配置已保存'); }, 500);
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>系统配置</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />}>重置</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>保存配置</Button>
        </Space>
      </div>

      <Card title="通用设置" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ maxUsers: 500, sessionTimeoutHours: 24, maxBacktestsPerUser: 10, defaultLeverage: 5, enableRegistration: true, enable2FA: false, maintenanceMode: false }}>
          <Form.Item name="maxUsers" label="最大注册用户数"><InputNumber min={1} max={10000} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="sessionTimeoutHours" label="会话超时 (小时)"><InputNumber min={1} max={168} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="maxBacktestsPerUser" label="每用户最大并发回测数"><InputNumber min={1} max={50} style={{ width: 200 }} /></Form.Item>
          <Form.Item name="defaultLeverage" label="默认杠杆倍数"><Select style={{ width: 200 }} options={[1,2,3,5,10,20].map((v) => ({ value: v, label: `${v}x` }))} /></Form.Item>
          <Divider />
          <Form.Item name="enableRegistration" label="允许新用户注册" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="enable2FA" label="强制双因素认证" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="maintenanceMode" label="维护模式" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Card>

      <Card title="风控参数" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', marginBottom: 16 }}>
        <Form layout="vertical" initialValues={{ maxLeverage: 10, maxPositionSize: 100000, dailyLossLimit: 5000 }}>
          <Form.Item name="maxLeverage" label="全局最大杠杆"><Select style={{ width: 200 }} options={[1,2,3,5,10,20,50].map((v) => ({ value: v, label: `${v}x` }))} /></Form.Item>
          <Form.Item name="maxPositionSize" label="单仓位最大金额 (USDT)"><InputNumber min={100} style={{ width: 200 }} prefix="$" /></Form.Item>
          <Form.Item name="dailyLossLimit" label="全局日亏损上限 (USDT)"><InputNumber min={100} style={{ width: 200 }} prefix="$" /></Form.Item>
        </Form>
      </Card>

      <Card title="通知配置" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <Form layout="vertical" initialValues={{ emailSmtp: 'smtp.quant.com', telegramBotToken: '', dingtalkWebhook: '' }}>
          <Form.Item name="emailSmtp" label="邮件 SMTP 服务器"><Input style={{ width: 300 }} /></Form.Item>
          <Form.Item name="telegramBotToken" label="Telegram Bot Token"><Input.Password style={{ width: 360 }} /></Form.Item>
          <Form.Item name="dingtalkWebhook" label="钉钉 Webhook URL"><Input style={{ width: 360 }} /></Form.Item>
          <Button type="primary" onClick={handleSave} loading={loading} icon={<SaveOutlined />}>保存所有配置</Button>
        </Form>
      </Card>
    </div>
  );
}
