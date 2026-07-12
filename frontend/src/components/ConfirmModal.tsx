import { Modal, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  content: React.ReactNode;
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = '确认操作',
  content,
  danger = false,
  confirmText = '确认',
  cancelText = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={
        <Space>
          {danger ? (
            <ExclamationCircleOutlined style={{ color: 'var(--red-trade)' }} />
          ) : (
            <WarningOutlined style={{ color: 'var(--warning)' }} />
          )}
          <span style={{ color: 'var(--text-primary)' }}>{title}</span>
        </Space>
      }
      onOk={onConfirm}
      onCancel={onCancel}
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{
        danger,
        loading,
      }}
      confirmLoading={loading}
      closable={!loading}
      maskClosable={!loading}
      styles={{
        body: {
          background: 'var(--bg-secondary)',
        },
        header: {
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        },
      }}
    >
      <Typography.Text style={{ color: 'var(--text-primary)' }}>
        {content}
      </Typography.Text>
    </Modal>
  );
}
