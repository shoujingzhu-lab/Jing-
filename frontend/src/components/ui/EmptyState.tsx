import { Empty, Button } from 'antd';

interface EmptyStateProps {
  image?: React.ReactNode;
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  /** 备选：直接传入操作按钮元素 */
  action?: React.ReactNode;
}

export default function EmptyState({
  image,
  title = '暂无数据',
  description,
  actionText,
  onAction,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
      }}
    >
      <Empty
        image={image || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <>
            <div style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 8 }}>{title}</div>
            {description && (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{description}</div>
            )}
          </>
        }
      >
        {action || (actionText && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionText}
          </Button>
        ))}
      </Empty>
    </div>
  );
}
