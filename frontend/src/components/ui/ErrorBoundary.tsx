import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card, Typography } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Card
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--red-trade)',
            textAlign: 'center',
            padding: '40px 20px',
          }}
        >
          <WarningOutlined style={{ fontSize: 48, color: 'var(--red-trade)', marginBottom: 16 }} />
          <Typography.Title level={4} style={{ color: 'var(--text-primary)' }}>
            组件加载异常
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {this.state.error?.message || '未知错误'}
          </Typography.Paragraph>
          <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleRetry}>
            重试
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

/** 通用错误卡片（非 ErrorBoundary） */
export function ErrorBoundaryCard({
  error,
  onRetry,
}: {
  error: Error | string;
  onRetry?: () => void;
}) {
  return (
    <Card
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--red-trade)',
        textAlign: 'center',
        padding: '24px 20px',
      }}
    >
      <WarningOutlined style={{ fontSize: 36, color: 'var(--red-trade)', marginBottom: 12 }} />
      <Typography.Text style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 12 }}>
        {typeof error === 'string' ? error : error.message}
      </Typography.Text>
      {onRetry && (
        <Button type="primary" size="small" icon={<ReloadOutlined />} onClick={onRetry}>
          重试
        </Button>
      )}
    </Card>
  );
}

export default ErrorBoundary;
