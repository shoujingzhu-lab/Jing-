import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  /** 变体 */
  variant?: 'default' | 'panel' | 'elevated';
  /** 是否可 hover（边框发光+上浮） */
  hoverable?: boolean;
  /** 选中态 */
  active?: boolean;
  /** 脉冲动画 */
  pulse?: boolean;
  /** 交错动画索引 */
  staggerIndex?: number;
  /** 点击 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
  style?: React.CSSProperties;
}

const variants = {
  default: 'glass-card',
  panel: 'glass-panel',
  elevated: 'glass glass-hover',
} as const;

/**
 * GlassCard — Glassmorphism 玻璃卡片
 *
 * 基于 framer-motion 的玻璃材质卡片，支持 hover 光晕、选中发光、脉冲动画。
 * 用于 Dashboard、策略卡片、数据面板等场景。
 */
export default function GlassCard({
  children,
  variant = 'default',
  hoverable = false,
  active = false,
  pulse = false,
  staggerIndex = 0,
  onClick,
  className = '',
  style,
}: GlassCardProps) {
  const baseClass = variants[variant];
  const classNames = [
    baseClass,
    hoverable && 'glass-hover',
    active && 'glass-active',
    pulse && 'glass-pulse',
    onClick && 'cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const motionProps: HTMLMotionProps<'div'> = {
    className: classNames,
    style,
    onClick,
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.3,
      delay: staggerIndex * 0.05,
      ease: [0.4, 0, 0.2, 1],
    },
    whileHover: hoverable
      ? {
          y: -2,
          transition: { duration: 0.2 },
        }
      : undefined,
    whileTap: onClick
      ? {
          scale: 0.98,
          transition: { duration: 0.1 },
        }
      : undefined,
  };

  return <motion.div {...motionProps}>{children}</motion.div>;
}
