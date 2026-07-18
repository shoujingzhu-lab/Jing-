/**
 * 动画系统工具模块
 *
 * 集中管理所有动画常量、缓动函数和变体定义。
 * 配合 src/styles/index.css 中的 CSS 关键帧使用。
 */

// ============================================================
// 动画时长常量
// ============================================================

export const DURATION = {
  fast: 150,
  normal: 250,
  slow: 350,
  page: 300,
  number: 400,
  shimmer: 1500,
  pulse: 2000,
} as const;

// ============================================================
// CSS 缓动函数
// ============================================================

export const EASING = {
  easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.6, 1)',
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
} as const;

// ============================================================
// 过渡字符串构建器
// ============================================================

export function transition(
  properties: string[],
  duration = DURATION.normal,
  easing = EASING.easeOut,
  delay = 0
): string {
  return properties
    .map((prop) => `${prop} ${duration}ms ${easing}${delay ? ` ${delay}ms` : ''}`)
    .join(', ');
}

/** 预设过渡字符串 */
export const TRANSITIONS = {
  fade: transition(['opacity'], DURATION.fast),
  slide: transition(['transform'], DURATION.normal),
  color: transition(['background-color', 'color', 'border-color'], DURATION.normal),
  all: transition(['all'], DURATION.normal),
  transform: transition(['transform', 'opacity'], DURATION.normal),
  shadow: transition(['box-shadow', 'border-color'], DURATION.normal),
} as const;

// ============================================================
// 动画变体 (与 CSS 类名对应)
// ============================================================

export const ANIMATION_VARIANTS = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  scaleIn: 'animate-scale-in',
  pageEnter: 'animate-page-enter',
  countUp: 'animate-count-up',
  pulseDot: 'animate-pulse-dot',
  flashGreen: 'flash-green',
  flashRed: 'flash-red',
  shimmer: 'skeleton-shimmer',
} as const;

// ============================================================
// 内联动画样式构建器
// ============================================================

export interface AnimationStyleOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  properties?: string[];
}

/**
 * 构建 CSS transition 内联样式
 */
export function buildTransitionStyle(
  props: string[] | string,
  options?: AnimationStyleOptions
): React.CSSProperties {
  const properties = Array.isArray(props) ? props : [props];
  const dur = options?.duration ?? DURATION.normal;
  const ease = options?.easing ?? EASING.easeOut;
  const del = options?.delay ?? 0;

  return {
    transition: properties
      .map((p) => `${p} ${dur}ms ${ease}${del ? ` ${del}ms` : ''}`)
      .join(', '),
  };
}

/**
 * 构建入场动画内联样式 (用于条件渲染组件)
 */
export function buildEnterAnimation(
  index = 0,
  staggerDelay = 50
): React.CSSProperties {
  return {
    animation: `slide-up ${DURATION.normal}ms ${EASING.easeOut} both`,
    animationDelay: `${index * staggerDelay}ms`,
  };
}

// ============================================================
// 列表交错动画 (Stagger)
// ============================================================

/**
 * 为列表项生成交错的入场动画样式
 * @param index 列表项索引
 * @param stagger 每个项的延迟间隔(ms)
 * @param variant 动画类型
 */
export function staggerStyle(
  index: number,
  stagger = 50,
  variant: 'slideUp' | 'fadeIn' | 'scaleIn' = 'slideUp'
): React.CSSProperties {
  const animName = variant === 'slideUp' ? 'slide-up' : variant === 'fadeIn' ? 'fade-in' : 'scale-in';
  const dur = variant === 'fadeIn' ? DURATION.fast : DURATION.normal;

  return {
    animation: `${animName} ${dur}ms ${EASING.easeOut} both`,
    animationDelay: `${index * stagger}ms`,
  };
}

// ============================================================
// 状态指示器动画
// ============================================================

/** 连接状态点颜色映射 */
export const STATUS_DOT_COLORS: Record<string, string> = {
  connected: '#26A69A',
  reconnecting: '#FF9800',
  disconnected: '#EF5350',
  online: '#26A69A',
  offline: '#EF5350',
  warning: '#FF9800',
  error: '#EF5350',
};

/** 获取状态点动画类名 */
export function getStatusAnimation(status: string): string {
  switch (status) {
    case 'connected':
    case 'online':
      return ''; // 静态
    case 'reconnecting':
    case 'warning':
      return 'animate-pulse-dot';
    case 'disconnected':
    case 'offline':
    case 'error':
      return ''; // 静态
    default:
      return '';
  }
}
