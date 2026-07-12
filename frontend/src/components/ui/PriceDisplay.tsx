import { useEffect, useState, useRef } from 'react';
import { getChangeColor } from '@/lib/utils/format';

interface PriceDisplayProps {
  price: number;
  decimals?: number;
  prefix?: string;
  style?: React.CSSProperties;
}

export default function PriceDisplay({ price, decimals = 2, prefix = '', style }: PriceDisplayProps) {
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

  const color = getChangeColor(price - prevPrice);

  return (
    <span
      className={`font-mono ${flashClass} ${color}`}
      style={{
        fontWeight: 600,
        transition: 'color 0.3s',
        ...style,
      }}
    >
      {prefix}
      {formattedPrice}
    </span>
  );
}
