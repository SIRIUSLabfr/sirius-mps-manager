import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface SummaryCardProps {
  label: string;
  value: number;
  color: string; // tailwind border-t color class
  total?: number;
  showProgress?: boolean;
  isAlert?: boolean;
}

export default function SummaryCard({ label, value, color, total, showProgress, isAlert }: SummaryCardProps) {
  const percent = total && total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className={cn('bg-card rounded-lg border border-border p-3 sm:p-5 relative overflow-hidden')}>
      <div className={cn('absolute top-0 left-0 right-0 h-[3px]', color)} />
      <p className="text-[10px] sm:text-xs font-body text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2">{label}</p>
      <p className={cn(
        'text-xl sm:text-3xl font-heading font-extrabold',
        isAlert && value > 0 ? 'text-destructive' : 'text-foreground'
      )}>
        {value}
      </p>
      {showProgress && total !== undefined && total > 0 && (
        <div className="mt-3">
          <Progress value={percent} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{percent} %</p>
        </div>
      )}
    </div>
  );
}
