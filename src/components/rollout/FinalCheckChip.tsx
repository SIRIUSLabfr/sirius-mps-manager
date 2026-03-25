import { cn } from '@/lib/utils';

const FINAL_CHECK_OPTIONS = [
  { value: 'ok', label: 'OK', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { value: 'ausstehend', label: 'Ausstehend', color: 'text-muted-foreground', bg: 'bg-muted' },
  { value: 'probleme', label: 'Probleme', color: 'text-destructive', bg: 'bg-destructive/10' },
];

interface FinalCheckChipProps {
  value: string | null;
  onChange: (val: string) => void;
}

export default function FinalCheckChip({ value, onChange }: FinalCheckChipProps) {
  const current = FINAL_CHECK_OPTIONS.find(o => o.value === value) || FINAL_CHECK_OPTIONS[1];
  const nextIndex = (FINAL_CHECK_OPTIONS.findIndex(o => o.value === value) + 1) % FINAL_CHECK_OPTIONS.length;

  return (
    <button
      onClick={() => onChange(FINAL_CHECK_OPTIONS[nextIndex].value)}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold transition-colors',
        current.bg, current.color
      )}
    >
      {current.label}
    </button>
  );
}
