import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Plus, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
}

interface AuditEntry {
  id: string;
  user_email: string | null;
  table_name: string;
  record_id: string | null;
  action: 'insert' | 'update' | 'delete';
  changes: Record<string, any>;
  description: string | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  order_processing: 'Vertragsdaten',
  devices: 'Geräte',
};

const FIELD_LABELS: Record<string, string> = {
  subject: 'Betreff',
  order_number: 'Auftragsnr.',
  order_date: 'Auftragsdatum',
  contract_type: 'Vertragsart',
  finance_type: 'Finanzierung',
  term_months: 'Laufzeit (Mon.)',
  factor: 'Leasingfaktor',
  rate: 'Gesamtrate',
  maintenance_share: 'Wartungsanteil',
  leasing_share: 'Leasinganteil',
  goods_value: 'Warenwert',
  gross_margin: 'Marge Gesamt',
  margin_hardware: 'Marge Hardware',
  margin_service: 'Marge Service',
  leasing_provider: 'Leasinggeber',
  payment_method: 'Zahlungsweise',
  contract_start: 'Vertragsbeginn',
  contract_end: 'Vertragsende',
  leasing_contract_nr: 'Leasing-Nr.',
  sx_contract_nr: 'SX-Nr.',
  soll_manufacturer: 'Hersteller',
  soll_model: 'Modell',
  soll_options: 'Optionen',
  location_id: 'Standort',
};

const fmtVal = (v: any): string => {
  if (v === null || v === undefined || v === '') return '–';
  if (typeof v === 'number') return v.toLocaleString('de-DE');
  return String(v);
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const actionIcon = (a: AuditEntry['action']) => {
  if (a === 'insert') return <Plus className="h-3 w-3" />;
  if (a === 'delete') return <Trash2 className="h-3 w-3" />;
  return <Pencil className="h-3 w-3" />;
};

const actionBadgeClass = (a: AuditEntry['action']) => {
  if (a === 'insert') return 'bg-green-100 text-green-800';
  if (a === 'delete') return 'bg-red-100 text-red-800';
  return 'bg-blue-100 text-blue-800';
};

export default function HistoryCard({ projectId }: Props) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit_log', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log' as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as AuditEntry[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historie
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-xs font-normal">
              {entries.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Lade…</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Noch keine Aktivitäten erfasst.
          </p>
        ) : (
          <div className="divide-y max-h-[480px] overflow-y-auto">
            {entries.map((e) => {
              const moduleLabel = TABLE_LABELS[e.table_name] || e.table_name;
              const changedFields =
                e.action === 'update' && e.changes
                  ? Object.entries(e.changes as Record<string, { from: any; to: any }>)
                  : [];
              return (
                <div key={e.id} className="px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] gap-1 h-5', actionBadgeClass(e.action))}
                    >
                      {actionIcon(e.action)}
                      {e.action === 'insert' ? 'angelegt' : e.action === 'delete' ? 'entfernt' : 'geändert'}
                    </Badge>
                    <span className="font-medium">{moduleLabel}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{fmtTime(e.created_at)}</span>
                    {e.user_email && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{e.user_email}</span>
                      </>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-muted-foreground mb-1">{e.description}</p>
                  )}
                  {changedFields.length > 0 && (
                    <ul className="space-y-0.5 ml-1">
                      {changedFields.map(([field, val]) => {
                        const label = FIELD_LABELS[field] || field;
                        return (
                          <li key={field} className="flex items-baseline gap-1.5">
                            <span className="text-muted-foreground">{label}:</span>
                            <span className="text-destructive/80 line-through">
                              {fmtVal(val?.from)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{fmtVal(val?.to)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
