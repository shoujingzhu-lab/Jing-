import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useSettingsStore } from '@/stores/settingsStore';
import { SIDEBAR_MENUS } from '@/lib/constants';

const { Sider: AntSider } = Layout;

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentModule = pathSegments[0] || 'dashboard';
  const sidebarItems = SIDEBAR_MENUS[currentModule] || [];

  if (sidebarItems.length === 0 && currentModule !== 'dashboard') {
    return null;
  }

  if (currentModule === 'dashboard') {
    return null;
  }

  const handleMenuClick = (info: { key: string }) => {
    const item = sidebarItems.find((s) => s.key === info.key);
    if (item?.path) {
      navigate(item.path);
    }
  };

  return (
    <AntSider
      width={200}
      collapsedWidth={0}
      collapsed={collapsed}
      trigger={null}
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1), min-width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            导航
          </span>
        )}
        <Button
          type="text"
          size="small"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleSidebar}
          style={{
            color: 'var(--text-secondary)',
            transition: 'transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        />
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
        items={sidebarItems.map((item) => ({
          key: item.path || item.key,
          label: item.label,
          icon: item.icon ? <span>{item.icon}</span> : undefined,
        }))}
        style={{
          background: 'transparent',
          borderRight: 'none',
        }}
        theme="dark"
      />
    </AntSider>
  );
}
