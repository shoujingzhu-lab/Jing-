import { Outlet } from 'react-router-dom';

/** 认证页面独立布局（无 Header/Sidebar/Footer，居中卡片式） */
export default function AuthLayout() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--bg-primary)',
      }}
    >
      <Outlet />
    </div>
  );
}
