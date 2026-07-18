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
        // 背景层级
        'bg-primary': '#0D1117',
        'bg-secondary': '#161B22',
        'bg-tertiary': '#21262D',
        // 边框
        'border-color': '#30363D',
        // 文本
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        // 交易色
        'green-trade': '#26A69A',
        'red-trade': '#EF5350',
        'green-bg': 'rgba(38,166,154,0.15)',
        'red-bg': 'rgba(239,83,80,0.15)',
        // 品牌/功能
        'brand': '#F0B90B',
        'warning': '#FF9800',
        'info': '#42A5F5',
        // 功能色背景
        'brand-bg': 'rgba(240,185,11,0.15)',
        'success-bg': 'rgba(38,166,154,0.15)',
        'error-bg': 'rgba(239,83,80,0.15)',
        'warning-bg': 'rgba(255,152,0,0.15)',
        'info-bg': 'rgba(66,165,245,0.15)',
        // 交互
        'hover-bg': 'rgba(255,255,255,0.06)',
        'active-bg': 'rgba(255,255,255,0.1)',
        // Glassmorphism 电光蓝
        'glass-primary': '#00D4FF',
        'glass-primary-bg': 'rgba(0, 212, 255, 0.12)',
        'glass-primary-glow': 'rgba(0, 212, 255, 0.2)',
        'glass-accent': '#8B5CF6',
        'glass-accent-bg': 'rgba(139, 92, 246, 0.12)',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      fontSize: {
        'xs': ['10px', { lineHeight: '14px' }],
        'sm': ['12px', { lineHeight: '16px' }],
        'base': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['28px', { lineHeight: '36px' }],
        '5xl': ['32px', { lineHeight: '40px' }],
        '6xl': ['40px', { lineHeight: '48px' }],
      },
      spacing: {
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
        'xl': '16px',
        'full': '9999px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.3)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.4)',
        'modal': '0 8px 24px rgba(0, 0, 0, 0.5)',
        'hover': '0 4px 16px rgba(240, 185, 11, 0.1)',
        'glow-brand': '0 0 12px rgba(240, 185, 11, 0.15)',
        'glow-green': '0 0 12px rgba(38, 166, 154, 0.15)',
        'glow-red': '0 0 12px rgba(239, 83, 80, 0.15)',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '350': '350ms',
      },
      transitionTimingFunction: {
        'out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'in': 'cubic-bezier(0.4, 0, 1, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.6, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      animation: {
        'flash-green': 'flashGreen 0.6s ease-out',
        'flash-red': 'flashRed 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'page-enter': 'pageEnter 0.3s ease-out',
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
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
  prefix: '',
  important: false,
  corePlugins: {
    preflight: false,
  },
}
