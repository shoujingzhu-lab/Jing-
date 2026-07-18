import { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

const { Content } = Layout;

/**
 * 主布局：Header + Sidebar + Content + Footer
 *
 * Content 区域包含页面过渡动画：路由变化时触发 fade+slide 入场。
 */
export default function MainLayout() {
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  // 路由变化时触发页面入场动画
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    // 移除并重新添加动画类以触发重播
    el.classList.remove('animate-page-enter');
    // 强制回流
    void (el as HTMLElement).offsetWidth;
    el.classList.add('animate-page-enter');
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header />

      <Layout>
        <Sidebar />

        <Content
          style={{
            background: 'var(--bg-primary)',
            overflow: 'auto',
            flex: 1,
          }}
        >
          <div
            ref={contentRef}
            style={{ padding: 20, minHeight: '100%' }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>

      <Footer />
    </Layout>
  );
}
