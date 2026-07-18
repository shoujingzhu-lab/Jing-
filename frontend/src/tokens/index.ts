/**
 * Jing- Design Token System
 *
 * 单一设计真源 (Single Source of Truth)，所有视觉决策在此集中管理。
 * — 颜色 → Ant Design ThemeConfig / CSS 变量 / Tailwind 配置
 * — 间距 → Tailwind spacing scale
 * — 字体大小 → Ant Design + Tailwind fontSize
 * — 阴影 → Tailwind boxShadow + 内联样式引用
 * — 过渡 → 组件动画 + CSS transitions
 * — 圆角 → Tailwind borderRadius + Ant Design borderRadius
 *
 * 风格: Glassmorphism — Apple Vision Pro × Cyber Finance
 * 主色: 电光蓝 #00D4FF + 紫色渐变辅助
 */

// ============================================================
// 颜色系统 (Color Palette)
// ============================================================

export const colors = {
  /** 暗色主题背景 */
  dark: {
    bgPrimary: '#0D1117',
    bgSecondary: '#161B22',
    bgTertiary: '#21262D',
    border: '#30363D',
    textPrimary: '#E6EDF3',
    textSecondary: '#8B949E',
  },

  /** 亮色主题背景 */
  light: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F6F8FA',
    bgTertiary: '#EBEEF2',
    border: '#D0D7DE',
    textPrimary: '#1F2328',
    textSecondary: '#656D76',
  },

  /** 品牌/功能色 — 暗色和亮色共享 */
  brand: '#F0B90B',
  success: '#26A69A',
  error: '#EF5350',
  warning: '#FF9800',
  info: '#42A5F5',

  /** 交易涨跌 */
  trading: {
    up: '#26A69A',
    down: '#EF5350',
    upBg: 'rgba(38, 166, 154, 0.15)',
    downBg: 'rgba(239, 83, 80, 0.15)',
    upBgLight: 'rgba(38, 166, 154, 0.1)',
    downBgLight: 'rgba(239, 83, 80, 0.1)',
  },

  /** 图表配色 (ECharts / Lightweight Charts) */
  chart: {
    grid: '#21262D',
    gridLight: '#D0D7DE',
    tooltipBg: 'rgba(22, 27, 34, 0.95)',
    tooltipBgLight: 'rgba(255, 255, 255, 0.95)',
    crosshair: '#30363D',
    crosshairLight: '#D0D7DE',
    series: ['#F0B90B', '#26A69A', '#42A5F5', '#FF9800', '#EF5350', '#9C27B0', '#00BCD4', '#FF5722'],
  },

  /** Glassmorphism 玻璃风格色 (电光蓝 + 紫) */
  glass: {
    primary: '#00D4FF',
    primaryBg: 'rgba(0, 212, 255, 0.12)',
    primaryGlow: 'rgba(0, 212, 255, 0.2)',
    accent: '#8B5CF6',
    accentBg: 'rgba(139, 92, 246, 0.12)',
    accentGlow: 'rgba(139, 92, 246, 0.2)',
    bg: 'rgba(15, 23, 42, 0.75)',
    bgHover: 'rgba(15, 23, 42, 0.88)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(0, 212, 255, 0.35)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    shadowHover: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.2)',
    shadowActive: '0 0 32px rgba(0, 212, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    blur: '32px',
    saturate: '180%',
  },

  /** 功能色背景 (半透明) */
  functional: {
    brandBg: 'rgba(240, 185, 11, 0.15)',
    successBg: 'rgba(38, 166, 154, 0.15)',
    errorBg: 'rgba(239, 83, 80, 0.15)',
    warningBg: 'rgba(255, 152, 0, 0.15)',
    infoBg: 'rgba(66, 165, 245, 0.15)',
  },

  /** 交互色 */
  interaction: {
    hover: 'rgba(255, 255, 255, 0.06)',
    hoverLight: 'rgba(0, 0, 0, 0.04)',
    active: 'rgba(255, 255, 255, 0.1)',
    activeLight: 'rgba(0, 0, 0, 0.08)',
    focus: 'rgba(240, 185, 11, 0.45)',
  },
} as const;

// ============================================================
// 间距系统 (Spacing Scale, 4px 基准)
// ============================================================

export const spacing = {
  unit: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

/** Tailwind spacing 映射 (px 字符串 → 用于 tailwind.config) */
export const tailwindSpacing = {
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
} as const;

// ============================================================
// 排版系统 (Typography Scale)
// ============================================================

export const typography = {
  fontFamily: {
    sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
    mono: `'JetBrains Mono', 'Fira Code', monospace`,
  },

  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 40,
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ============================================================
// 阴影系统 (Shadow Elevations)
// ============================================================

export const shadows = {
  /** 卡片/面板 — 低海拔 */
  card: '0 1px 3px rgba(0, 0, 0, 0.3)',
  cardLight: '0 1px 3px rgba(0, 0, 0, 0.08)',

  /** 弹出层 — 中海拔 */
  elevated: '0 4px 12px rgba(0, 0, 0, 0.4)',
  elevatedLight: '0 4px 12px rgba(0, 0, 0, 0.12)',

  /** 模态框 — 高海拔 */
  modal: '0 8px 24px rgba(0, 0, 0, 0.5)',
  modalLight: '0 8px 24px rgba(0, 0, 0, 0.15)',

  /** 悬停卡片 */
  hover: '0 4px 16px rgba(240, 185, 11, 0.1)',
  hoverLight: '0 4px 16px rgba(240, 185, 11, 0.08)',

  /** 无阴影 */
  none: 'none',
} as const;

// ============================================================
// 过渡/动画 (Transitions)
// ============================================================

export const transitions = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    page: '300ms',
  },

  easing: {
    easeOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.6, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },

  /** 常用过渡缩写 */
  presets: {
    fade: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    slide: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    color: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), color 250ms cubic-bezier(0.4, 0, 0.2, 1), border-color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    all: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ============================================================
// 圆角系统 (Border Radius)
// ============================================================

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ============================================================
// Z-Index 层级
// ============================================================

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// ============================================================
// 组件级 Token
// ============================================================

export const components = {
  header: {
    height: 56,
  },
  sidebar: {
    width: 220,
    collapsedWidth: 0,
  },
  footer: {
    height: 28,
  },
  content: {
    padding: spacing.xl,
  },
  statCard: {
    valueFontSize: 24,
    valueFontWeight: typography.fontWeight.bold,
    valueFontFamily: typography.fontFamily.mono,
  },
  table: {
    size: 'middle' as const,
  },
  chart: {
    loadingMaskColor: 'rgba(13, 17, 23, 0.6)',
    loadingSpinnerColor: '#F0B90B',
  },
} as const;

// ============================================================
// 导出汇总 (方便一次性导入)
// ============================================================

const tokens = {
  colors,
  spacing,
  tailwindSpacing,
  typography,
  shadows,
  transitions,
  radius,
  zIndex,
  components,
} as const;

export default tokens;
