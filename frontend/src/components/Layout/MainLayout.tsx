import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

const { Content } = Layout;

/** 主布局：Header + Sidebar + Content + Footer（需求文档 3.1 节） */
export default function MainLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header />

      <Layout>
        {/* 左侧子导航 */}
        <Sidebar />

        {/* 内容区域 */}
        <Content
          style={{
            background: 'var(--bg-primary)',
            overflow: 'auto',
            flex: 1,
          }}
        >
          <div style={{ padding: 20 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* 底部状态栏 */}
      <Footer />
    </Layout>
  );
}
