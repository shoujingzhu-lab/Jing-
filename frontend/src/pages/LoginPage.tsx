import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Divider, message, Space, InputNumber } from 'antd';
import { MailOutlined, LockOutlined, SafetyOutlined, MobileOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import { CONFIG } from '@/lib/constants';

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少 8 个字符'),
});

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 2FA 状态
  const [show2FA, setShow2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  // 锁定倒计时
  const [lockCountdown, setLockCountdown] = useState(0);
  const [lockReason, setLockReason] = useState('');

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const timer = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockCountdown]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const validateField = (name: keyof LoginFormValues) => {
    const value = form.getFieldValue(name);
    if (!value) return;
    // rememberMe 不在 Zod schema 中，跳过
    if (!(name in loginSchema.shape)) return;
    const fieldSchema = loginSchema.shape[name as keyof typeof loginSchema.shape];
    const result = fieldSchema.safeParse(value);
    setErrors((prev) => ({
      ...prev,
      [name]: result.success ? '' : result.error.issues[0]?.message || '',
    }));
  };

  const handleSubmit = async (values: LoginFormValues) => {
    // Zod 全量校验
    const result = loginSchema.safeParse(values);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // 实际 API 调用
      const res = await authApi.login({ email: values.email, password: values.password });

      // 需要 2FA
      if ((res.data as unknown as { require2FA?: boolean }).require2FA) {
        setShow2FA(true);
        setLoading(false);
        return;
      }

      const { accessToken, refreshToken, expiresIn, user } = res.data.data;
      login(user, accessToken, refreshToken, expiresIn, values.rememberMe);
      message.success('登录成功');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '登录失败';

      // 账户锁定
      if (msg.includes('锁定') || msg.includes('locked')) {
        setLockCountdown(CONFIG.LOCK_DURATION_MINUTES * 60);
        setLockReason('账户已被锁定，请稍后再试');
      }
      // 剩余尝试次数
      if (msg.includes('attempt')) {
        const match = msg.match(/(\d+)/);
        if (match && parseInt(match[1]) <= 3) {
          message.warning(`密码错误，还剩 ${match[1]} 次尝试机会`);
          return;
        }
      }

      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) {
      message.error('请输入 6 位验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login({
        email: form.getFieldValue('email'),
        password: form.getFieldValue('password'),
      });
      const { accessToken, refreshToken, expiresIn, user } = res.data.data;
      login(user, accessToken, refreshToken, expiresIn, form.getFieldValue('rememberMe'));
      message.success('登录成功');
      navigate('/');
    } catch {
      message.error('验证码错误或已过期');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{ width: 400, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      styles={{ body: { padding: '32px 40px' } }}
    >
      {/* 品牌区 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <span style={{ fontSize: 36 }}>📊</span>
        <Typography.Title level={3} style={{ color: 'var(--text-primary)', marginTop: 8, marginBottom: 4 }}>
          量化交易系统
        </Typography.Title>
        <Typography.Text style={{ color: 'var(--text-secondary)' }}>登录您的账户</Typography.Text>
      </div>

      {/* 锁定倒计时横幅 */}
      {lockCountdown > 0 && (
        <div
          style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red-trade)',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <Typography.Text style={{ color: 'var(--red-trade)', fontSize: 13 }}>
            🔒 {lockReason} — 剩余 {formatCountdown(lockCountdown)}
          </Typography.Text>
        </div>
      )}

      {/* 2FA 输入 */}
      {show2FA ? (
        <div style={{ textAlign: 'center' }}>
          <SafetyOutlined style={{ fontSize: 40, color: 'var(--brand)', marginBottom: 16 }} />
          <Typography.Title level={5} style={{ color: 'var(--text-primary)' }}>
            双重验证
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            请输入验证器 App 中的 6 位验证码
          </Typography.Paragraph>
          <InputNumber
            value={totpCode ? Number(totpCode) : null}
            onChange={(v) => setTotpCode(v ? String(v) : '')}
            maxLength={6}
            style={{ width: 200, marginBottom: 20 }}
            controls={false}
            placeholder="输入 6 位验证码"
            size="large"
            disabled={loading}
          />
          <br />
          <Space>
            <Button onClick={() => setShow2FA(false)} disabled={loading}>返回</Button>
            <Button type="primary" onClick={handleVerify2FA} loading={loading}>
              验证并登录
            </Button>
          </Space>
        </div>
      ) : (
        <Form<LoginFormValues>
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          initialValues={{ rememberMe: true }}
        >
          {/* 账号 */}
          <Form.Item
            name="email"
            validateStatus={errors.email ? 'error' : ''}
            help={errors.email}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="邮箱或手机号"
              onBlur={() => validateField('email')}
              autoComplete="email"
              disabled={loading || lockCountdown > 0}
            />
          </Form.Item>

          {/* 密码 */}
          <Form.Item
            name="password"
            validateStatus={errors.password ? 'error' : ''}
            help={errors.password}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              onBlur={() => validateField('password')}
              autoComplete="current-password"
              disabled={loading || lockCountdown > 0}
            />
          </Form.Item>

          {/* 记住我 + 忘记密码 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Form.Item name="rememberMe" valuePropName="checked" noStyle>
              <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                <input type="checkbox" style={{ marginRight: 6 }} defaultChecked />
                记住我
              </Typography.Text>
            </Form.Item>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              忘记密码？
            </Link>
          </div>

          {/* 登录按钮 */}
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={lockCountdown > 0}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      )}

      <Divider plain style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', fontSize: 12 }}>
        或
      </Divider>
      <div style={{ textAlign: 'center' }}>
        <Typography.Text style={{ color: 'var(--text-secondary)' }}>
          还没有账号？ <Link to="/register" style={{ color: 'var(--brand)' }}>去注册</Link>
        </Typography.Text>
      </div>
    </Card>
  );
}
