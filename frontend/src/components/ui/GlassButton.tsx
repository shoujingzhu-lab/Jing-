import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassButtonProps {
  children: ReactNode;
  /** primary | secondary */
  variant?: 'primary' | 'secondary';
  /** 是否加载中 */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}

/**
 * GlassButton — 玻璃风格按钮
 *
 * primary: 电光蓝渐变 + 发光 + 按压内缩
 * secondary: 透明边框 + hover 填充
 */
export default function GlassButton({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  style,
  type = 'button',
}: GlassButtonProps) {
  const baseClass = variant === 'primary' ? 'glass-btn' : 'glass-btn-secondary';

  return (
    <motion.button
      type={type}
      className={`${baseClass} ${className}`}
      style={{ opacity: disabled ? 0.5 : 1, ...style }}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.15 }}
    >
      {loading && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ display: 'inline-block', fontSize: 14 }}
        >
          ⏳
        </motion.span>
      )}
      {children}
    </motion.button>
  );
}
