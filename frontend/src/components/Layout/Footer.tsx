import { Layout, Tag, Space } from 'antd';
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const { Footer: AntFooter } = Layout;

export default function Footer() {
  const { t } = useTranslation();
  const wsStatus = useAppStore((s) => s.wsStatus);
  const marketLatency = useAppStore((s) => s.marketLatency);
  const currentUtcTime = useAppStore((s) => s.currentUtcTime);

  const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    connected: {
      icon: <CheckCircleOutlined />,
      color: '#26A69A',
      label: t('footer.online'),
    },
    reconnecting: {
      icon: <SyncOutlined spin />,
      color: '#FF9800',
      label: t('footer.reconnecting'),
    },
    disconnected: {
      icon: <CloseCircleOutlined />,
      color: '#EF5350',
      label: t('footer.offline'),
    },
  };

  const current = statusConfig[wsStatus] || statusConfig.disconnected;

  return (
    <AntFooter
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        height: 28,
        lineHeight: '28px',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <Space size="middle">
        <Tag
          icon={current.icon}
          color={current.color}
          style={{ margin: 0, fontSize: 11, lineHeight: '20px' }}
        >
          {current.label}
        </Tag>
        <span>
          {t('footer.latency')}: {marketLatency}ms
        </span>
      </Space>
      <Space size="middle">
        <span>
          {t('footer.systemTime')} UTC: {currentUtcTime ? dayjs(currentUtcTime).utc().format('YYYY-MM-DD HH:mm:ss') : '--'}
        </span>
        <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>v1.0.0</span>
      </Space>
    </AntFooter>
  );
}
