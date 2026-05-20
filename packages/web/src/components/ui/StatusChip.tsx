import { clsx } from 'clsx';

type Status = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

const statusConfig: Record<Status, { label: string; classes: string }> = {
  ACTIVE:    { label: 'Active',    classes: 'bg-green-500/10 text-green-400 border-green-500/20' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  PENDING:   { label: 'Pending',   classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
};

export function StatusChip({ status }: { status: Status }) {
  const cfg = statusConfig[status] ?? statusConfig.PENDING;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        cfg.classes,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {cfg.label}
    </span>
  );
}
