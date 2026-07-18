import { Layout, Tag, Space } from 'antd';
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const { Footer: AntFooter } = Layout;

/** 连接状态配置 */
const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string; animated: boolean }> = {
  connected: {
    icon: <CheckCircleOutlined />,
    color: '#26A69A',
    label: '在线',
    animated: false,
  },
  reconnecting: {
    icon: <SyncOutlined spin />,
    color: '#FF9800',
    label: '重连中',
    animated: true,
  },
  disconnected: {
    icon: <CloseCircleOutlined />,
    color: '#EF5350',
    label: '离线',
    animated: false,
  },
};

export default function Footer() {
  const { t } = useTranslation();
  const wsStatus = useAppStore((s) => s.wsStatus);
  const marketLatency = useAppStore((s) => s.marketLatency);
  const currentUtcTime = useAppStore((s) => s.currentUtcTime);

  const current = STATUS_CONFIG[wsStatus] || STATUS_CONFIG.disconnected;

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
        {/* WebSocket 状态 + 动画脉冲点 */}
        <Tag
          icon={
            <Space size={4}>
              {current.animated && (
                <span
                  className="animate-pulse-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: current.color,
                    display: 'inline-block',
                  }}
                />
              )}
              {current.icon}
            </Space>
          }
          color={current.color}
          style={{ margin: 0, fontSize: 11, lineHeight: '20px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {t('footer.online', { defaultValue: current.label })}
        </Tag>
        <span>
          {t('footer.latency')}: {marketLatency}ms
        </span>
      </Space>
      <Space size="middle">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
          {t('footer.systemTime')} UTC: {currentUtcTime ? dayjs(currentUtcTime).utc().format('YYYY-MM-DD HH:mm:ss') : '--'}
        </span>
        <span style={{ color: 'var(--text-secondary)', opacity: 0.5, fontSize: 11 }}>v1.0.0</span>
      </Space>
    </AntFooter>
  );
}
