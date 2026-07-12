import { InputNumber, Tooltip } from 'antd';

interface AmountInputProps {
  value?: number;
  onChange?: (value: number | null) => void;
  symbol?: string;
  max?: number;
  min?: number;
  precision?: number;
  placeholder?: string;
  warningThreshold?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function AmountInput({
  value,
  onChange,
  symbol,
  max,
  min = 0,
  precision = 2,
  placeholder = '请输入数量',
  warningThreshold,
  disabled,
  style,
}: AmountInputProps) {
  const isWarning = warningThreshold && value && value >= warningThreshold;

  return (
    <Tooltip
      title={
        isWarning
          ? `⚠ 输入金额较大，请确认 (≥ ${warningThreshold})`
          : undefined
      }
      open={isWarning ? undefined : false}
    >
      <InputNumber
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        precision={precision}
        placeholder={placeholder}
        disabled={disabled}
        addonAfter={symbol}
        status={isWarning ? 'warning' : undefined}
        style={{
          width: '100%',
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--bg-tertiary)',
          ...style,
        }}
        formatter={(val) => (val !== undefined && val !== null ? `${val}` : '')}
        parser={(val) => {
          if (!val) return 0;
          const parsed = parseFloat(val!.replace(/[^0-9.]/g, ''));
          return isNaN(parsed) ? 0 : parsed;
        }}
      />
    </Tooltip>
  );
}
