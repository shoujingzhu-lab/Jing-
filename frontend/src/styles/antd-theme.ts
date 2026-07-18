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
    // 品牌色
    colorPrimary: colors.brand,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.error,
    colorInfo: colors.info,

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
      headerBg: colors.dark.bgSecondary,
      siderBg: colors.dark.bgSecondary,
      triggerBg: colors.dark.bgTertiary,
    },
    Menu: {
      darkItemBg: colors.dark.bgSecondary,
      darkSubMenuItemBg: colors.dark.bgTertiary,
      darkItemSelectedBg: colors.functional.brandBg,
      darkItemHoverBg: colors.interaction.hover,
    },
    Card: {
      colorBgContainer: colors.dark.bgSecondary,
    },
    Table: {
      headerBg: colors.dark.bgTertiary,
      rowHoverBg: colors.interaction.hover,
      borderColor: colors.dark.border,
    },
    Input: {
      colorBgContainer: colors.dark.bgTertiary,
      activeBorderColor: colors.brand,
    },
    InputNumber: {
      colorBgContainer: colors.dark.bgTertiary,
      activeBorderColor: colors.brand,
    },
    Select: {
      colorBgContainer: colors.dark.bgTertiary,
      optionSelectedBg: colors.functional.brandBg,
    },
    Button: {
      colorPrimaryBg: colors.brand,
      primaryShadow: 'none',
    },
    Tabs: {
      colorText: colors.dark.textSecondary,
      inkBarColor: colors.brand,
      itemSelectedColor: colors.brand,
      itemHoverColor: colors.dark.textPrimary,
    },
    Tooltip: {
      colorBgSpotlight: colors.dark.bgTertiary,
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
    // 品牌色（与暗色主题共用）
    colorPrimary: colors.brand,
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
      inkBarColor: colors.brand,
      itemSelectedColor: colors.brand,
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
