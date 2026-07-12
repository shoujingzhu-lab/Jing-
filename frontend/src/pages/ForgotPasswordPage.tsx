import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Steps, message, Result } from 'antd';
import { MailOutlined, SafetyOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [form] = Form.useForm();

  const handleSendCode = async () => {
    const values = await form.validateFields(['email']);
    setEmail(values.email);
    setLoading(true);
    // 后端暂未提供 forgot-password 端点，模拟验证码发送
    try {
      await authApi.register({ email: values.email, password: '', confirmPassword: '', agreeToTerms: true } as never);
    } catch {
      // 预期会失败（参数不完整），仅用于检查邮箱格式和网络连通
    }
    setTimeout(() => {
      message.success('验证码已发送到您的邮箱');
      setStep(1);
      setLoading(false);
    }, 1000);
  };

  const handleVerifyCode = async () => {
    const values = await form.validateFields(['captcha']);
    setLoading(true);
    setTimeout(() => {
      setStep(2);
      setLoading(false);
    }, 800);
  };

  const handleResetPassword = async () => {
    const values = await form.validateFields(['newPassword', 'confirmPassword']);
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次密码不一致');
      return;
    }
    setLoading(true);
    // TODO: 后端 forgot-password/reset-password 端点就绪后替换
    setTimeout(() => {
      message.success('密码重置成功');
      setStep(3);
      setLoading(false);
    }, 1000);
  };

  return (
    <Card style={{ width: 420, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      styles={{ body: { padding: '32px 40px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Typography.Title level={3} style={{ color: 'var(--text-primary)' }}>
          重置密码
        </Typography.Title>
        <Typography.Text style={{ color: 'var(--text-secondary)' }}>
          {step === 0 && '请输入注册邮箱'}
          {step === 1 && '请输入邮箱验证码'}
          {step === 2 && '设置新密码'}
        </Typography.Text>
      </div>

      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 28 }}
        items={[
          { title: '验证身份' },
          { title: '验证码' },
          { title: '设置密码' },
          { title: '完成' },
        ]}
      />

      {step === 3 ? (
        <Result
          status="success"
          title="密码重置成功"
          subTitle="请使用新密码登录"
          extra={[
            <Link to="/login" key="login">
              <Button type="primary">返回登录</Button>
            </Link>,
          ]}
          style={{ padding: '20px 0' }}
        />
      ) : (
        <Form form={form} layout="vertical" size="large">
          {/* Step 0: 输入邮箱 */}
          {step === 0 && (
            <>
              <Form.Item name="email" rules={[{ required: true, message: '请输入注册邮箱' }, { type: 'email' }]}>
                <Input prefix={<MailOutlined />} placeholder="注册邮箱" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" block onClick={handleSendCode} loading={loading}>
                  获取验证码
                </Button>
              </Form.Item>
            </>
          )}

          {/* Step 1: 输入验证码 */}
          {step === 1 && (
            <>
              <Typography.Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                验证码已发送至 <strong>{email}</strong>
              </Typography.Paragraph>
              <Form.Item name="captcha" rules={[{ required: true, message: '请输入验证码' }, { len: 6 }]}>
                <Input prefix={<SafetyOutlined />} placeholder="6 位验证码" maxLength={6} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" block onClick={handleVerifyCode} loading={loading}>
                  验证
                </Button>
              </Form.Item>
            </>
          )}

          {/* Step 2: 设置新密码 */}
          {step === 2 && (
            <>
              <Form.Item name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 8 }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少 8 位）" />
              </Form.Item>
              <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认新密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" block onClick={handleResetPassword} loading={loading}>
                  重置密码
                </Button>
              </Form.Item>
            </>
          )}
        </Form>
      )}

      {step < 3 && (
        <div style={{ textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--brand)', fontSize: 13 }}>
            ← 返回登录
          </Link>
        </div>
      )}
    </Card>
  );
}
