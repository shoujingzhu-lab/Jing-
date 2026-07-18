import type { ThemeConfig } from 'antd';
import { colors, typography, radius, spacing } from '@/tokens';

/**
 * 暗色主题配置
 *
 * 所有颜色值源自 src/tokens/index.ts 设计 Token 系统，
 * 保证 Ant Design 组件与自定义组件视觉一致。
 */
export const darkTheme: ThemeConfig = {
  token: {
    // 品牌色 — Glassmorphism 电光蓝
    colorPrimary: '#00D4FF',
    colorSuccess: '#26A69A',
    colorWarning: '#FF9800',
    colorError: '#EF5350',
    colorInfo: '#42A5F5',

    // 背景/文字
    colorTextBase: colors.dark.textPrimary,
    colorBgBase: colors.dark.bgPrimary,
    colorBgContainer: colors.dark.bgSecondary,
    colorBgElevated: colors.dark.bgTertiary,
    colorBorder: colors.dark.border,
    colorText: colors.dark.textPrimary,
    colorTextSecondary: colors.dark.textSecondary,
    colorTextTertiary: colors.dark.textSecondary,

    // 排版
    borderRadius: radius.md,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    controlHeight: 36,
  },
  components: {
    Layout: {
      bodyBg: colors.dark.bgPrimary,
      headerBg: 'rgba(15, 23, 42, 0.7)',
      siderBg: 'rgba(15, 23, 42, 0.6)',
      triggerBg: colors.dark.bgTertiary,
    },
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'rgba(15, 23, 42, 0.4)',
      darkItemSelectedBg: 'rgba(0, 212, 255, 0.15)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
    },
    Card: {
      colorBgContainer: colors.dark.bgSecondary,
    },
    Table: {
      headerBg: 'rgba(15, 23, 42, 0.4)',
      rowHoverBg: 'rgba(0, 212, 255, 0.06)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    Input: {
      colorBgContainer: 'rgba(255, 255, 255, 0.04)',
      activeBorderColor: '#00D4FF',
    },
    InputNumber: {
      colorBgContainer: 'rgba(255, 255, 255, 0.04)',
      activeBorderColor: '#00D4FF',
    },
    Select: {
      colorBgContainer: colors.dark.bgTertiary,
      optionSelectedBg: 'rgba(0, 212, 255, 0.15)',
    },
    Button: {
      colorPrimaryBg: '#00D4FF',
      primaryShadow: '0 0 16px rgba(0, 212, 255, 0.3)',
    },
    Tabs: {
      colorText: colors.dark.textSecondary,
      inkBarColor: '#00D4FF',
      itemSelectedColor: '#00D4FF',
      itemHoverColor: colors.dark.textPrimary,
    },
    Tooltip: {
      colorBgSpotlight: 'rgba(15, 23, 42, 0.95)',
    },
    Dropdown: {
      colorBgElevated: colors.dark.bgSecondary,
    },
    Modal: {
      colorBgElevated: colors.dark.bgSecondary,
      headerBg: colors.dark.bgSecondary,
      titleColor: colors.dark.textPrimary,
      titleFontSize: typography.fontSize.lg,
    },
    Notification: {
      colorBgElevated: colors.dark.bgSecondary,
    },
    Tag: {
      defaultBg: colors.dark.bgTertiary,
      defaultColor: colors.dark.textSecondary,
    },
    Progress: {
      defaultColor: colors.brand,
      remainingColor: colors.dark.border,
    },
    Slider: {
      trackBg: colors.brand,
      trackHoverBg: colors.brand,
      railBg: colors.dark.border,
      handleColor: colors.brand,
      handleActiveColor: colors.brand,
    },
    Switch: {
      colorPrimary: colors.brand,
      colorPrimaryHover: colors.brand,
    },
    Segmented: {
      itemSelectedBg: colors.functional.brandBg,
      itemSelectedColor: colors.brand,
      trackBg: colors.dark.bgTertiary,
    },
    Drawer: {
      colorBgElevated: colors.dark.bgSecondary,
    },
    Popover: {
      colorBgElevated: colors.dark.bgSecondary,
    },
    Timeline: {
      dotBg: colors.dark.bgSecondary,
    },
  },
};

/**
 * 亮色主题配置
 */
export const lightTheme: ThemeConfig = {
  token: {
    // 品牌色 — Glassmorphism 电光蓝
    colorPrimary: '#0098B8',
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.error,
    colorInfo: colors.info,

    // 背景/文字
    colorTextBase: colors.light.textPrimary,
    colorBgBase: colors.light.bgPrimary,
    colorBgContainer: colors.light.bgSecondary,
    colorBgElevated: colors.light.bgPrimary,
    colorBorder: colors.light.border,
    colorText: colors.light.textPrimary,
    colorTextSecondary: colors.light.textSecondary,

    // 排版
    borderRadius: radius.md,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    controlHeight: 36,
  },
  components: {
    Layout: {
      bodyBg: colors.light.bgPrimary,
      headerBg: colors.light.bgSecondary,
      siderBg: colors.light.bgSecondary,
    },
    Menu: {
      itemBg: colors.light.bgSecondary,
      itemSelectedBg: colors.functional.brandBg,
      itemHoverBg: colors.interaction.hoverLight,
    },
    Card: {
      colorBgContainer: colors.light.bgPrimary,
    },
    Table: {
      headerBg: colors.light.bgTertiary,
      rowHoverBg: colors.interaction.hoverLight,
      borderColor: colors.light.border,
    },
    Input: {
      colorBgContainer: colors.light.bgPrimary,
      activeBorderColor: colors.brand,
    },
    InputNumber: {
      colorBgContainer: colors.light.bgPrimary,
      activeBorderColor: colors.brand,
    },
    Select: {
      colorBgContainer: colors.light.bgPrimary,
      optionSelectedBg: colors.functional.brandBg,
    },
    Button: {
      primaryShadow: 'none',
    },
    Tabs: {
      inkBarColor: '#0098B8',
      itemSelectedColor: '#0098B8',
    },
    Tooltip: {
      colorBgSpotlight: colors.dark.bgTertiary,
    },
    Dropdown: {
      colorBgElevated: colors.light.bgPrimary,
    },
    Modal: {
      colorBgElevated: colors.light.bgPrimary,
      headerBg: colors.light.bgPrimary,
      titleColor: colors.light.textPrimary,
      titleFontSize: typography.fontSize.lg,
    },
    Notification: {
      colorBgElevated: colors.light.bgPrimary,
    },
    Progress: {
      remainingColor: colors.light.border,
    },
    Slider: {
      railBg: colors.light.border,
    },
    Segmented: {
      itemSelectedBg: colors.functional.brandBg,
      itemSelectedColor: colors.brand,
      trackBg: colors.light.bgTertiary,
    },
    Drawer: {
      colorBgElevated: colors.light.bgPrimary,
    },
    Popover: {
      colorBgElevated: colors.light.bgPrimary,
    },
  },
};
