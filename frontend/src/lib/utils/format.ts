import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化加密货币数量
 */
export function formatCryptoAmount(amount: number, symbol?: string): string {
  const isBTC = symbol?.startsWith('BTC');
  const decimals = isBTC ? 4 : amount >= 1 ? 2 : 4;
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化 USDT 金额
 */
export function formatUSDT(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace('US$', '$');
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number | string): string {
  return dayjs(timestamp).fromNow();
}

/**
 * 格式化绝对时间
 */
export function formatTime(timestamp: number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(timestamp).format(format);
}

/**
 * 格式化 UTC 时间
 */
export function formatUTCTime(timestamp: number | string): string {
  return `${dayjs(timestamp).utc().format('YYYY-MM-DD HH:mm:ss')} UTC`;
}

/**
 * 格式化大数缩写
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * 格式化数字（带千分位）
 */
export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 获取涨跌颜色类名
 */
export function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-trade';
  if (value < 0) return 'text-red-trade';
  return 'text-text-secondary';
}

/**
 * 获取涨跌背景色类名
 */
export function getChangeBgColor(value: number): string {
  if (value > 0) return 'bg-green-bg';
  if (value < 0) return 'bg-red-bg';
  return '';
}

/**
 * 截断地址显示
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * 计算百分比变化
 */
export function calcChangePercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
}

/**
 * 安全 JSON 解析
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * 间隔时间格式化（毫秒 → 可读字符串）
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
  return `${seconds}秒`;
}
