import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Steps, message, Progress, Divider, Checkbox } from 'antd';
import { MailOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { authApi } from '@/lib/api';

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string()
    .min(8, '密码至少 8 个字符')
    .regex(/[A-Z]/, '需包含大写字母')
    .regex(/[a-z]/, '需包含小写字母')
    .regex(/[0-9]/, '需包含数字'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema> & { captcha: string; agreeToTerms: boolean };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<RegisterFormValues>();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [captchaCountdown, setCaptchaCountdown] = useState(0);

  // 密码强度
  const password = Form.useWatch('password', form);
  const passwordStrength = getPasswordStrength(password || '');

  useEffect(() => {
    if (captchaCountdown <= 0) return;
    const timer = setInterval(() => {
      setCaptchaCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [captchaCountdown]);

  const handleSendCaptcha = () => {
    const email = form.getFieldValue('email');
    if (!email) { message.warning('请先输入邮箱'); return; }
    // TODO: 调用发送验证码 API
    message.success('验证码已发送');
    setCaptchaCountdown(60);
  };

  const handleSubmit = async (values: RegisterFormValues) => {
    const result = registerSchema.safeParse(values);
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
      await authApi.register({
        email: values.email,
        password: values.password,
        confirmPassword: values.confirmPassword,
        agreeToTerms: values.agreeToTerms,
      });
      message.success('注册成功，欢迎加入！');
      navigate('/login');
    } catch (err: unknown) {
      message.error((err as { message?: string })?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 440, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Typography.Title level={3} style={{ color: 'var(--text-primary)' }}>
          创建账户
        </Typography.Title>
        <Typography.Text style={{ color: 'var(--text-secondary)' }}>
          加入量化交易系统
        </Typography.Text>
      </div>

      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 28 }}
        items={[
          { title: '填写信息' },
          { title: '验证邮箱' },
          { title: '完成注册' },
        ]}
      />

      <Form<RegisterFormValues>
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
        size="large"
        initialValues={{ agreeToTerms: false }}
      >
        {/* 邮箱 */}
        <Form.Item name="email" validateStatus={errors.email ? 'error' : ''} help={errors.email}>
          <Input prefix={<MailOutlined />} placeholder="邮箱" autoComplete="email" />
        </Form.Item>

        {/* 密码 */}
        <Form.Item name="password" validateStatus={errors.password ? 'error' : ''} help={errors.password}>
          <Input.Password prefix={<LockOutlined />} placeholder="密码（8 位以上，含大小写字母和数字）" />
        </Form.Item>

        {/* 密码强度指示条 */}
        {password && (
          <div style={{ marginTop: -16, marginBottom: 16 }}>
            <Progress
              percent={passwordStrength.score}
              size="small"
              strokeColor={passwordStrength.color}
              format={() => passwordStrength.label}
              style={{ marginBottom: 4 }}
            />
            <ul style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 16, margin: 0 }}>
              {passwordStrength.checks.map((c, i) => (
                <li key={i} style={{ color: c.pass ? 'var(--green-trade)' : 'var(--text-secondary)' }}>
                  {c.pass ? '✅' : '○'} {c.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 确认密码 */}
        <Form.Item name="confirmPassword" validateStatus={errors.confirmPassword ? 'error' : ''} help={errors.confirmPassword}>
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
        </Form.Item>

        {/* 验证码 */}
        <Form.Item name="captcha">
          <Input
            prefix={<SafetyOutlined />}
            placeholder="邮箱验证码"
            suffix={
              <Button
                type="link"
                size="small"
                onClick={handleSendCaptcha}
                disabled={captchaCountdown > 0}
              >
                {captchaCountdown > 0 ? `${captchaCountdown}s` : '发送验证码'}
              </Button>
            }
          />
        </Form.Item>

        {/* 协议 */}
        <Form.Item name="agreeToTerms" valuePropName="checked">
          <Checkbox style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            我已阅读并同意 <a href="#" style={{ color: 'var(--brand)' }}>用户协议</a> 和 <a href="#" style={{ color: 'var(--brand)' }}>隐私政策</a>
          </Checkbox>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            注 册
          </Button>
        </Form.Item>
      </Form>

      <Divider plain style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', fontSize: 12 }} />
      <div style={{ textAlign: 'center' }}>
        <Typography.Text style={{ color: 'var(--text-secondary)' }}>
          已有账号？ <Link to="/login" style={{ color: 'var(--brand)' }}>去登录</Link>
        </Typography.Text>
      </div>
    </Card>
  );
}

/** 密码强度检测 */
function getPasswordStrength(pwd: string) {
  const checks = [
    { text: '至少 8 个字符', pass: pwd.length >= 8 },
    { text: '包含大写字母', pass: /[A-Z]/.test(pwd) },
    { text: '包含小写字母', pass: /[a-z]/.test(pwd) },
    { text: '包含数字', pass: /[0-9]/.test(pwd) },
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const score = (passCount / checks.length) * 100;

  let color = 'var(--red-trade)';
  let label = '弱';
  if (passCount >= 4) { color = 'var(--green-trade)'; label = '强'; }
  else if (passCount >= 3) { color = 'var(--warning)'; label = '中'; }

  return { score, color, label, checks };
}
