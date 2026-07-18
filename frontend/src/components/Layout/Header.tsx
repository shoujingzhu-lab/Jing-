import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Badge, Avatar, Dropdown, Space, Tag } from 'antd';
import {
  BellOutlined,
  UserOutlined,
  SettingOutlined,
  KeyOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAppStore } from '@/stores/appStore';
import { MAIN_NAV } from '@/lib/constants';
import type { Exchange } from '@/lib/types';

const { Header: AntHeader } = Layout;

const EXCHANGE_ICONS: Record<Exchange, string> = {
  binance: '🔶',
  okx: '🔷',
  bybit: '⬛',
  gate: '🟢',
};

const STATUS_COLORS: Record<string, string> = {
  connected: '#26A69A',
  reconnecting: '#FF9800',
  disconnected: '#EF5350',
};

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const exchangeConnections = useAppStore((s) => s.exchangeConnections);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentModule = pathSegments[0] || 'dashboard';

  const handleMenuClick = useCallback((info: { key: string }) => {
    const item = MAIN_NAV.find((n) => n.key === info.key);
    if (item?.path) {
      navigate(item.path);
    }
  }, [navigate]);

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '账户设置',
      onClick: () => navigate('/settings'),
    },
    {
      key: 'api-keys',
      icon: <KeyOutlined />,
      label: 'API Key 管理',
      onClick: () => navigate('/settings/api-keys'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <AntHeader
      className="glass-panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderRadius: 0,
        height: 56,
        lineHeight: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'background 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Logo + 品牌 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          marginRight: 24,
          transition: 'transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        onClick={() => navigate('/')}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
      >
        <span style={{ fontSize: 22, filter: 'drop-shadow(0 0 6px rgba(240, 185, 11, 0.3))' }}>📊</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand)', letterSpacing: '1px' }}>
          量化交易系统
        </span>
      </div>

      {/* 主导航菜单 */}
      <Menu
        mode="horizontal"
        selectedKeys={[currentModule]}
        onClick={handleMenuClick}
        items={MAIN_NAV.map((item) => {
          if (item.children && item.children.length > 0) {
            return {
              key: item.key,
              label: item.label,
              children: item.children
                .filter((child) => !child.roles || (user && child.roles.includes(user.role)))
                .map((child) => ({
                  key: child.key,
                  label: child.label,
                  onClick: () => child.path && navigate(child.path),
                })),
            };
          }
          return { key: item.key, label: item.label };
        })}
        style={{
          flex: 1,
          background: 'transparent',
          borderBottom: 'none',
          minWidth: 0,
        }}
        theme="dark"
      />

      {/* 右侧工具栏 */}
      <Space size="middle">
        {/* 交易所连接状态 */}
        <Space size={4}>
          {exchangeConnections.map((conn) => {
            const isConnected = conn.status === 'connected';
            return (
              <Tag
                key={conn.exchange}
                color={STATUS_COLORS[conn.status]}
                style={{
                  margin: 0,
                  fontSize: 11,
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {/* 状态脉冲点 */}
                <span
                  className={isConnected ? 'animate-pulse-dot' : ''}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#26A69A' : '#EF5350',
                    display: 'inline-block',
                  }}
                />
                {EXCHANGE_ICONS[conn.exchange]}
              </Tag>
            );
          })}
        </Space>

        {/* 通知 */}
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined
            style={{
              fontSize: 18,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 150ms, transform 200ms',
            }}
            onClick={() => navigate('/notifications')}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--brand)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          />
        </Badge>

        {/* 用户 */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space
            style={{
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: '2px 8px',
              borderRadius: 8,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ backgroundColor: 'var(--brand)', color: '#000' }}
            >
              {user?.nickname?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <span style={{ fontSize: 13 }}>{user?.nickname || user?.email}</span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
