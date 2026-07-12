import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <Typography.Title style={{ color: 'var(--text-primary)', fontSize: 72 }}>404</Typography.Title>
      <Typography.Paragraph style={{ color: 'var(--text-secondary)', fontSize: 18, marginBottom: 24 }}>
        页面不存在
      </Typography.Paragraph>
      <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
    </div>
  );
}
