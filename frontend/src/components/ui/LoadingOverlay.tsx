import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingOverlayProps {
  /** 是否显示 */
  visible: boolean;
  /** 加载提示文本 */
  tip?: string;
  /** 是否全屏 */
  fullscreen?: boolean;
  /** 遮罩透明度 */
  opacity?: number;
  /** 子元素 (section 模式) */
  children?: React.ReactNode;
}

/**
 * LoadingOverlay — 加载遮罩层
 *
 * 支持全屏模式（覆盖整个视口）和区域模式（覆盖父容器）。
 * 用于页面级加载、数据获取中等场景。
 */
export default function LoadingOverlay({
  visible,
  tip = '加载中...',
  fullscreen = false,
  opacity = 0.6,
  children,
}: LoadingOverlayProps) {
  if (!visible) return <>{children}</>;

  const overlayStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
      };

  return (
    <div style={{ position: 'relative', ...(fullscreen ? {} : {}) }}>
      {children}
      {visible && (
        <div
          style={{
            ...overlayStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `rgba(13, 17, 23, ${opacity})`,
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            animation: 'fade-in 0.2s ease-out',
            borderRadius: fullscreen ? 0 : 8,
          }}
        >
          <Spin
            indicator={
              <LoadingOutlined
                style={{ fontSize: 32, color: 'var(--brand)' }}
                spin
              />
            }
          />
          {tip && (
            <div
              style={{
                marginTop: 16,
                color: 'var(--text-secondary)',
                fontSize: 14,
                animation: 'slide-up 0.3s ease-out',
              }}
            >
              {tip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
