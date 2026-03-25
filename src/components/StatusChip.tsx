import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from '@/lib/constants';

interface StatusChipProps {
  status: string;
  className?: string;
}

export default function StatusChip({ status, className }: StatusChipProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-heading font-semibold',
        config.bg,
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
