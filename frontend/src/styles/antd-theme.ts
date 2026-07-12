import type { ThemeConfig } from 'antd';

/** 暗色主题配置（需求文档 6.1 节） */
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#F0B90B',
    colorSuccess: '#26A69A',
    colorWarning: '#FF9800',
    colorError: '#EF5350',
    colorInfo: '#42A5F5',
    colorTextBase: '#E6EDF3',
    colorBgBase: '#0D1117',
    colorBgContainer: '#161B22',
    colorBgElevated: '#21262D',
    colorBorder: '#30363D',
    colorText: '#E6EDF3',
    colorTextSecondary: '#8B949E',
    colorTextTertiary: '#8B949E',
    borderRadius: 8,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Layout: {
      bodyBg: '#0D1117',
      headerBg: '#161B22',
      siderBg: '#161B22',
      triggerBg: '#21262D',
    },
    Menu: {
      darkItemBg: '#161B22',
      darkSubMenuItemBg: '#21262D',
      darkItemSelectedBg: 'rgba(240,185,11,0.15)',
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
    },
    Card: {
      colorBgContainer: '#161B22',
    },
    Table: {
      headerBg: '#21262D',
      rowHoverBg: 'rgba(255,255,255,0.04)',
      borderColor: '#30363D',
    },
    Input: {
      colorBgContainer: '#21262D',
    },
    Select: {
      colorBgContainer: '#21262D',
    },
    Button: {
      colorPrimaryBg: '#F0B90B',
    },
    Tabs: {
      colorText: '#8B949E',
      inkBarColor: '#F0B90B',
    },
    Tooltip: {
      colorBgSpotlight: '#21262D',
    },
  },
};

/** 亮色主题配置 */
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#F0B90B',
    colorSuccess: '#26A69A',
    colorWarning: '#FF9800',
    colorError: '#EF5350',
    colorInfo: '#42A5F5',
    colorTextBase: '#1F2328',
    colorBgBase: '#FFFFFF',
    colorBgContainer: '#F6F8FA',
    colorBgElevated: '#FFFFFF',
    colorBorder: '#D0D7DE',
    colorText: '#1F2328',
    colorTextSecondary: '#656D76',
    borderRadius: 8,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
    fontSize: 14,
  },
  components: {
    Layout: {
      bodyBg: '#FFFFFF',
      headerBg: '#F6F8FA',
      siderBg: '#F6F8FA',
    },
    Card: {
      colorBgContainer: '#FFFFFF',
    },
    Table: {
      headerBg: '#EBEEF2',
    },
    Input: {
      colorBgContainer: '#FFFFFF',
    },
  },
};
