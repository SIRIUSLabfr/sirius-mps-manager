export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Entwurf', color: 'text-muted-foreground', bg: 'bg-muted' },
  planning: { label: 'Planung', color: 'text-primary', bg: 'bg-primary/10' },
  preparation: { label: 'Vorbereitung', color: 'text-amber-700', bg: 'bg-amber-100' },
  rollout_active: { label: 'Rollout aktiv', color: 'text-secondary', bg: 'bg-secondary/10' },
  completed: { label: 'Abgeschlossen', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  cancelled: { label: 'Abgebrochen', color: 'text-destructive', bg: 'bg-destructive/10' },
};

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}
