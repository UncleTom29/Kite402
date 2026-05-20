import { clsx } from 'clsx';

interface USDCAmountProps {
  amount: bigint | string | number;
  className?: string;
  decimals?: number;
}

export function USDCAmount({ amount, className, decimals = 2 }: USDCAmountProps) {
  const raw = BigInt(amount.toString());
  const dollars = Number(raw) / 1e6;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(dollars);

  return (
    <span className={clsx('tabular-nums font-mono', className)}>
      <span className="text-kite-muted">$</span>
      {formatted}
      <span className="text-kite-muted text-xs ml-1">USDC</span>
    </span>
  );
}
