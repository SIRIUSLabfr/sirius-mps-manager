import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  label: string | null;
  finance_type: string | null;
  term_months: number | null;
  total_monthly_rate: number | null;
  total_hardware_ek: number | null;
  config_json: any;
  is_active: boolean | null;
}

const fmt = (v: number | null) =>
  (v ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ScenarioCompare({
  scenarios,
  onActivate,
  onClose,
}: {
  scenarios: Scenario[];
  onActivate: (id: string) => void;
  onClose: () => void;
}) {
  if (scenarios.length < 2) return null;

  const rates = scenarios.map(s => s.total_monthly_rate ?? Infinity);
  const minRate = Math.min(...rates);
  const totalCosts = scenarios.map(s => (s.total_monthly_rate ?? 0) * (s.term_months ?? 60));
  const minTotal = Math.min(...totalCosts);
  const deviceCounts = scenarios.map(s => {
    const groups = (s.config_json as any)?.device_groups || [];
    return groups.reduce((sum: number, g: any) => sum + (g.mainQuantity || 1), 0);
  });

  const rows: { label: string; values: string[]; highlights: boolean[] }[] = [
    {
      label: 'Finanzierung',
      values: scenarios.map(s => s.finance_type === 'leasing' ? 'Leasing' : 'Miete'),
      highlights: Array(scenarios.length).fill(false),
    },
    {
      label: 'Laufzeit',
      values: scenarios.map(s => `${s.term_months ?? 60} Monate`),
      highlights: Array(scenarios.length).fill(false),
    },
    {
      label: 'Monatl. Rate',
      values: scenarios.map(s => `${fmt(s.total_monthly_rate)} €`),
      highlights: rates.map(r => r === minRate && r !== Infinity),
    },
    {
      label: 'Gesamtkosten',
      values: totalCosts.map(t => `${fmt(t)} €`),
      highlights: totalCosts.map(t => t === minTotal && t > 0),
    },
    {
      label: 'Geräte',
      values: deviceCounts.map(d => String(d)),
      highlights: Array(scenarios.length).fill(false),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-base">Szenarien-Vergleich</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Schließen</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 text-xs font-heading text-muted-foreground w-[140px]"></th>
                {scenarios.map(s => (
                  <th key={s.id} className="text-center py-2 px-3 font-heading text-xs">
                    {s.label || 'Szenario'}
                    {s.is_active && <span className="ml-1 text-[10px] text-primary">(aktiv)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-b last:border-b-0">
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground font-medium">{row.label}</td>
                  {row.values.map((val, i) => (
                    <td key={i} className={cn('text-center py-2.5 px-3 font-medium', row.highlights[i] && 'text-green-600 font-bold')}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-4"></td>
                {scenarios.map(s => (
                  <td key={s.id} className="text-center py-3 px-3">
                    <Button
                      size="sm"
                      variant={s.is_active ? 'default' : 'outline'}
                      className="gap-1.5 text-xs h-7"
                      onClick={() => onActivate(s.id)}
                      disabled={!!s.is_active}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {s.is_active ? 'Aktiv' : 'Aktivieren'}
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
