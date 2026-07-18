# 设计 Token 参考

> 单一设计真源：`src/tokens/index.ts`

## 颜色系统

### 背景色

| Token | 暗色 | 亮色 | 用途 |
|-------|------|------|------|
| `--bg-primary` | `#0D1117` | `#FFFFFF` | 页面主背景 |
| `--bg-secondary` | `#161B22` | `#F6F8FA` | 卡片/面板背景 |
| `--bg-tertiary` | `#21262D` | `#EBEEF2` | 输入框/表格头背景 |

### 文字色

| Token | 暗色 | 亮色 | 用途 |
|-------|------|------|------|
| `--text-primary` | `#E6EDF3` | `#1F2328` | 主要文字 |
| `--text-secondary` | `#8B949E` | `#656D76` | 次要文字/标签 |

### 品牌/功能色

| Token | 值 | 用途 |
|-------|-----|------|
| `--brand` | `#F0B90B` | 主色调（金色） |
| `--green-trade` | `#26A69A` | 上涨/买入 |
| `--red-trade` | `#EF5350` | 下跌/卖出 |
| `--warning` | `#FF9800` | 警告 |
| `--info` | `#42A5F5` | 信息 |

### 使用建议

- **bg-primary**: 页面 body/Content 背景
- **bg-secondary**: Card、Modal、Dropdown、Sider 背景
- **bg-tertiary**: Input、Select、Table header 背景
- **border-color**: 所有边框

## 间距 (4px 基准)

| 名称 | px | 用途 |
|------|-----|------|
| `1` | 4px | 微小间距 |
| `2` | 8px | 紧凑间距 |
| `3` | 12px | 元素间 |
| `4` | 16px | 标准内边距 |
| `5` | 20px | 页面内边距 |
| `6` | 24px | 段落间距 |
| `8` | 32px | 大间距 |
| `10` | 40px | 区域间距 |
| `12` | 48px | 空状态内边距 |

## 排版

### 字体

- **Sans**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`
- **Mono**: `'JetBrains Mono', 'Fira Code', monospace`

### 字号

| Token | px | 用途 |
|-------|-----|------|
| `xs` | 10 | 极小辅助文本 |
| `sm` | 12 | 标签/辅助信息 |
| `base` | 14 | 正文（默认） |
| `lg` | 16 | 小标题 |
| `xl` | 18 | 按钮文字 |
| `3xl` | 24 | 数据展示（StatCard） |

## 阴影

| Token | 用途 |
|-------|------|
| `--shadow-card` | 卡片/面板 |
| `--shadow-elevated` | Dropdown/Popover |
| `--shadow-modal` | Modal/Drawer |
| `--shadow-hover` | 卡片悬停 |
| `--shadow-glow-brand` | 选中态光晕 |

## 动画

| Token | 值 | 用途 |
|-------|-----|------|
| `--transition-fast` | 150ms | Hover 效果 |
| `--transition-normal` | 250ms | 展开/折叠 |
| `--transition-slow` | 350ms | Modal 动画 |
| `--transition-color` | 250ms | 主题切换 |

## 圆角

| Token | px | 用途 |
|-------|-----|------|
| `sm` | 4px | 标签/Tag |
| `md` | 8px | 卡片/输入框（默认） |
| `lg` | 12px | Modal |
| `full` | 9999px | 圆形元素 |
