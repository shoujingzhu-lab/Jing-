/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 需求文档 6.1 色彩系统
        'bg-primary': '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary': '#21262D',
        'border-color': '#30363D',
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        'green-trade': '#26A69A',
        'red-trade': '#EF5350',
        'green-bg': 'rgba(38,166,154,0.15)',
        'red-bg': 'rgba(239,83,80,0.15)',
        'brand': '#F0B90B',
        'warning': '#FF9800',
        'info': '#42A5F5',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      spacing: {
        // 4px 基准间距系统
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
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'full': '9999px',
      },
      animation: {
        'flash-green': 'flashGreen 0.6s ease-out',
        'flash-red': 'flashRed 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(38,166,154,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(239,83,80,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
  // 避免与 Ant Design 类名冲突
  prefix: '',
  important: false,
  corePlugins: {
    preflight: false, // 禁用 Tailwind 的基础样式重置，使用 Ant Design 的
  },
}
