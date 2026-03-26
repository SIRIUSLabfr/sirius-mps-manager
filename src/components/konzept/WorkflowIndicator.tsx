import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  status: 'done' | 'active' | 'pending';
}

export default function WorkflowIndicator({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-heading font-semibold text-[11px]',
            step.status === 'done' && 'bg-emerald-50 border-emerald-200 text-emerald-700',
            step.status === 'active' && 'bg-primary/10 border-primary/30 text-primary',
            step.status === 'pending' && 'bg-muted border-border text-muted-foreground',
          )}>
            {step.status === 'done' ? (
              <Check className="h-3 w-3" />
            ) : (
              <Circle className={cn('h-2.5 w-2.5', step.status === 'active' ? 'fill-primary' : 'fill-muted-foreground/30')} />
            )}
            {step.label}
          </div>
        </div>
      ))}
    </div>
  );
}
