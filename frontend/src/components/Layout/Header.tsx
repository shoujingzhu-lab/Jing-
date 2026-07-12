import { useState } from 'react';
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

  // 确定当前选中的主导航
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentModule = pathSegments[0] || 'dashboard';

  const handleMenuClick = (info: { key: string }) => {
    const item = MAIN_NAV.find((n) => n.key === info.key);
    if (item?.path) {
      navigate(item.path);
    }
  };

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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        height: 56,
        lineHeight: '56px',
      }}
    >
      {/* Logo + 品牌 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginRight: 24 }}
        onClick={() => navigate('/')}
      >
        <span style={{ fontSize: 22 }}>📊</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand)' }}>量化交易系统</span>
      </div>

      {/* 主导航菜单 */}
      <Menu
        mode="horizontal"
        selectedKeys={[currentModule]}
        onClick={handleMenuClick}
        items={MAIN_NAV.map((item) => {
          // 处理子菜单
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
          return {
            key: item.key,
            label: item.label,
          };
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
          {exchangeConnections.map((conn) => (
            <Tag
              key={conn.exchange}
              color={STATUS_COLORS[conn.status]}
              style={{ margin: 0, fontSize: 11, padding: '0 6px' }}
            >
              {EXCHANGE_ICONS[conn.exchange]}
            </Tag>
          ))}
        </Space>

        {/* 通知 */}
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <BellOutlined
            style={{ fontSize: 18, color: 'var(--text-secondary)', cursor: 'pointer' }}
            onClick={() => navigate('/notifications')}
          />
        </Badge>

        {/* 用户 */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: 'var(--brand)', color: '#000' }}>
              {user?.nickname?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
            <span style={{ fontSize: 13 }}>{user?.nickname || user?.email}</span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
