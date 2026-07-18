import { useEffect, useState, useRef } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { getChangeColor } from '@/lib/utils/format';

interface PriceDisplayProps {
  price: number;
  decimals?: number;
  prefix?: string;
  /** 显示趋势箭头 */
  showTrend?: boolean;
  /** 参考价格（用于判断趋势方向，默认用上一次价格） */
  referencePrice?: number;
  style?: React.CSSProperties;
}

export default function PriceDisplay({
  price,
  decimals = 2,
  prefix = '',
  showTrend = false,
  referencePrice,
  style,
}: PriceDisplayProps) {
  const [prevPrice, setPrevPrice] = useState(price);
  const [flashClass, setFlashClass] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price !== prevPrice) {
      const direction = price > prevPrice ? 'flash-green' : 'flash-red';
      setFlashClass(direction);
      setPrevPrice(price);

      timerRef.current = setTimeout(() => {
        setFlashClass('');
      }, 600);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [price, prevPrice]);

  const formattedPrice = price.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const comparePrice = referencePrice ?? prevPrice;
  const changeColor = getChangeColor(price - comparePrice);
  const TrendIcon = price >= comparePrice ? ArrowUpOutlined : ArrowDownOutlined;

  return (
    <span
      className={`font-mono tabular-nums ${flashClass} ${changeColor}`}
      style={{
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        transition: 'color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        ...style,
      }}
    >
      {prefix}
      {formattedPrice}
      {showTrend && price !== comparePrice && (
        <TrendIcon style={{ fontSize: 11 }} />
      )}
    </span>
  );
}
