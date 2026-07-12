import { Typography, Card } from 'antd';

interface Props { title: string }

export default function PlaceholderPage({ title }: Props) {
  return (
    <div>
      <Typography.Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 20 }}>
        {title}
      </Typography.Title>
      <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 16 }}>
          🚧 {title} — 页面功能开发中，将在后续阶段实现
        </div>
      </Card>
    </div>
  );
}
