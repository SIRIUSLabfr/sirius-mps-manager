import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useProject } from '@/hooks/useProjectData';
import { useOrderProcessing, useUpdateOrderProcessing, useUpsertOrderProcessing } from '@/hooks/useOrderProcessing';
import { STEP_GROUPS, getGroupsForType, countSteps, countGroupSteps, generateEmptySteps, STATUS_OPTIONS } from '@/lib/orderProcessingConfig';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { DateInputString } from '@/components/ui/date-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Check, ClipboardList, FileSignature, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import BeauftragteGeraeteCard from '@/components/abwicklung/BeauftragteGeraeteCard';
import { zohoClient, ZOHO_CONTRACT_MODULE } from '@/lib/zohoClient';
import { buildVertragPayload } from '@/lib/zohoQuoteBuilder';
import { supabase } from '@/integrations/supabase/client';

export default function AbwicklungPage() {
  const { projectId } = useParams();
  const { activeProjectId } = useActiveProject();
  const pid = projectId || activeProjectId;
  const { data: project } = useProject(pid || null);
  const { data: processing, isLoading } = useOrderProcessing(pid || null);
  const updateMut = useUpdateOrderProcessing();
  const upsertMut = useUpsertOrderProcessing();

  const projectType = (project as any)?.project_type || 'project';
  const groups = getGroupsForType(projectType);

  // Auto-create processing record if it doesn't exist
  useEffect(() => {
    if (pid && !isLoading && !processing && project) {
      upsertMut.mutate({
        project_id: pid,
        steps: generateEmptySteps(projectType),
        status: 'offen',
      });
    }
  }, [pid, isLoading, processing, project]);

  const steps = processing?.steps || {};
  const { total, done } = countSteps(steps, groups);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const saveField = useCallback((field: string, value: any) => {
    if (!processing?.id) return;
    updateMut.mutate({ id: processing.id, updates: { [field]: value } });
  }, [processing?.id, updateMut]);

  const saveSteps = useCallback((newSteps: any) => {
    if (!processing?.id) return;
    updateMut.mutate({ id: processing.id, updates: { steps: newSteps } });
  }, [processing?.id, updateMut]);

  const toggleStep = (groupKey: string, stepKey: string) => {
    const current = { ...steps };
    if (!current[groupKey]) current[groupKey] = {};
    const cur = current[groupKey][stepKey] || { done: false, note: '' };
    current[groupKey] = { ...current[groupKey], [stepKey]: { ...cur, done: !cur.done } };
    saveSteps(current);
  };

  const updateNote = (groupKey: string, stepKey: string, note: string) => {
    const current = { ...steps };
    if (!current[groupKey]) current[groupKey] = {};
    const cur = current[groupKey][stepKey] || { done: false, note: '' };
    current[groupKey] = { ...current[groupKey], [stepKey]: { ...cur, note } };
    saveSteps(current);
  };

  // Collapsible state - all open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    STEP_GROUPS.forEach(g => o[g.key] = true);
    return o;
  });
  const [contractOpen, setContractOpen] = useState(false);
  const [contractSyncing, setContractSyncing] = useState(false);

  /** Vertrag im Zoho-Custom-Modul Vertr_ge anlegen, alle Werte aus der
   *  Nachkalkulation + Vertragsdaten uebernehmen. Bei Erfolg wird die
   *  Zoho-Vertrag-ID in projects.quote_config.zoho_contract_id geparkt
   *  (kein neuer DB-Spalten-Bedarf). */
  const handleCreateContract = async () => {
    if (!pid || !processing) {
      toast.error('Keine Abwicklungs-Daten geladen.');
      return;
    }
    if (!processing.rate || !processing.term_months) {
      if (!confirm('Gesamtrate oder Laufzeit fehlen. Trotzdem in Zoho anlegen?')) return;
    }
    setContractSyncing(true);
    try {
      // Account aus dem verknuepften Deal holen (fuer den Account-Lookup
      // im Vertrag-Record).
      const { data: row } = await supabase
        .from('projects')
        .select('zoho_deal_id, zoho_estimate_id, zoho_sales_order_id, quote_config, project_name, customer_name, project_number')
        .eq('id', pid)
        .maybeSingle();
      let accountId: string | undefined;
      if (row?.zoho_deal_id) {
        try {
          const dealRes = await zohoClient.getDeal(row.zoho_deal_id);
          accountId = dealRes?.data?.[0]?.Account_Name?.id;
        } catch { /* deal optional */ }
      }

      // Vertragsnummer (`Name`, Pflichtfeld): Auftragsnr aus den
      // Vertragsdaten bevorzugt, sonst Angebots-/Projektnummer, sonst
      // Datumsnotation als Fallback.
      const vertragsnummer =
        processing.order_number ||
        row?.project_number ||
        `Vertrag ${new Date().toLocaleDateString('de-DE')}`;

      const payload = buildVertragPayload({
        vertragsnummer,
        kundenname: row?.customer_name || undefined,
        accountId,
        vertragsart: processing.contract_type,
        finanzprodukt: processing.finance_type,
        grundlaufzeit: processing.term_months,
        gesamtrateMonatl: processing.rate,
        leasingfaktor: processing.factor,
        wartungsrateMonatl: processing.maintenance_share,
        leasingrateMonatl: processing.leasing_share,
        warennettowert: processing.goods_value,
        vertragsbeginn: processing.contract_start,
        grundlaufzeitende: processing.contract_end,
      });

      const res = await zohoClient.createContract(payload);
      const detail = res?.data?.[0];
      const contractId = detail?.details?.id;
      if (!contractId) {
        throw new Error('Zoho lieferte keine Vertrags-ID zurück.');
      }
      // Vertrag-ID in quote_config persistieren (keine neue DB-Spalte noetig).
      const existingConfig = (row?.quote_config as Record<string, any>) || {};
      await supabase
        .from('projects')
        .update({ quote_config: { ...existingConfig, zoho_contract_id: contractId } } as any)
        .eq('id', pid);
      toast.success(`Vertrag in Zoho angelegt: #${contractId}`);
    } catch (err: any) {
      console.error('[Vertrag-Sync]', err);
      toast.error('Vertrag-Anlage fehlgeschlagen: ' + (err?.message || err));
    } finally {
      setContractSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Laden...</div>;
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === processing?.status) || STATUS_OPTIONS[0];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-xl font-bold">Abwicklung</h1>
        </div>
        <Select
          value={processing?.status || 'offen'}
          onValueChange={(v) => saveField('status', v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <Badge className={cn('text-xs', s.color)} variant="secondary">{s.label}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Progress */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{done} von {total} Schritten erledigt ({pct}%)</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)))',
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {groups.map(g => {
            const gc = countGroupSteps(steps, g);
            const allDone = gc.done === gc.total;
            return (
              <Badge
                key={g.key}
                variant="secondary"
                className={cn(
                  'text-xs font-normal',
                  allDone && 'bg-green-100 text-green-800',
                )}
              >
                {g.label} {gc.done}/{gc.total} {allDone && '✓'}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Contract data (collapsible) */}
      <Collapsible open={contractOpen} onOpenChange={setContractOpen}>
        <div className="rounded-xl border bg-card">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-xl">
            <span className="font-heading font-semibold text-sm">Vertragsdaten</span>
            {contractOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4">
              {/* Stammdaten + Vertrags-Eckdaten */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <ContractField label="Betreff" value={processing?.subject} onChange={v => saveField('subject', v)} />
                <ContractField label="Auftragsnr." value={processing?.order_number} onChange={v => saveField('order_number', v)} />
                <ContractField label="Auftragsdatum" value={processing?.order_date} onChange={v => saveField('order_date', v)} type="date" />
                <ContractField label="Vertragsart" value={processing?.contract_type} onChange={v => saveField('contract_type', v)} />
                <ContractField label="Finanzierung" value={processing?.finance_type} onChange={v => saveField('finance_type', v)} />
                <ContractField label="Laufzeit (Mon.)" value={processing?.term_months} onChange={v => saveField('term_months', v ? parseInt(v) : null)} type="number" />
                <ContractField label="Warenwert" value={processing?.goods_value} onChange={v => saveField('goods_value', v ? parseFloat(v) : null)} type="number" />
                <ContractField label="Vertragsbeginn" value={processing?.contract_start} onChange={v => saveField('contract_start', v)} type="date" />
                <ContractField label="Vertragsende" value={processing?.contract_end} onChange={v => saveField('contract_end', v)} type="date" />
                <ContractField label="Leasing-Nr." value={processing?.leasing_contract_nr} onChange={v => saveField('leasing_contract_nr', v)} />
                <ContractField label="SX-Nr." value={processing?.sx_contract_nr} onChange={v => saveField('sx_contract_nr', v)} />
              </div>

              {/* Nachkalkulation: hier wird der konkrete Faktor + die
                  Aufteilung Leasing/Wartung gepflegt, sobald die Bank den
                  Vertrag konkretisiert hat. */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  Nachkalkulation
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ContractField label="Gesamtrate" value={processing?.rate} onChange={v => saveField('rate', v ? parseFloat(v) : null)} type="number" />
                  <ContractField label="Leasingfaktor" value={processing?.factor} onChange={v => saveField('factor', v ? parseFloat(v) : null)} type="number" />
                  <ContractField label="Wartungsanteil" value={processing?.maintenance_share} onChange={v => saveField('maintenance_share', v ? parseFloat(v) : null)} type="number" />
                  <ContractField label="Leasinganteil" value={processing?.leasing_share} onChange={v => saveField('leasing_share', v ? parseFloat(v) : null)} type="number" />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button size="sm" onClick={handleCreateContract} disabled={contractSyncing}>
                  {contractSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Vertrag in Zoho anlegen
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Beauftragte Geräte: Liste editierbar, mit Push in SOP */}
      {pid && <BeauftragteGeraeteCard projectId={pid} />}

      {/* Step groups */}
      {groups.map(group => {
        const gc = countGroupSteps(steps, group);
        const isOpen = openGroups[group.key] !== false;
        return (
          <Collapsible key={group.key} open={isOpen} onOpenChange={v => setOpenGroups(o => ({ ...o, [group.key]: v }))}>
            <div className="rounded-xl border bg-card overflow-hidden">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-heading font-semibold text-sm">{group.label}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    gc.done === gc.total && 'bg-green-100 text-green-800',
                  )}
                >
                  {gc.done}/{gc.total}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y">
                  {group.steps.map((step, idx) => {
                    const sd = steps?.[group.key]?.[step.key] || { done: false, note: '' };
                    return (
                      <StepRow
                        key={step.key}
                        label={step.label}
                        done={sd.done}
                        note={sd.note}
                        even={idx % 2 === 0}
                        onToggle={() => toggleStep(group.key, step.key)}
                        onNoteChange={(note) => updateNote(group.key, step.key, note)}
                      />
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

function ContractField({ label, value, onChange, type = 'text' }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  const [local, setLocal] = useState(value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocal(value ?? ''); }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 800);
  };

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {type === 'date' ? (
        <DateInputString
          value={local || null}
          onChange={v => { setLocal(v ?? ''); onChange(v ?? ''); }}
          size="sm"
        />
      ) : (
        <Input
          type={type}
          value={local}
          onChange={e => handleChange(e.target.value)}
          className="h-8 text-sm"
        />
      )}
    </div>
  );
}

function StepRow({ label, done, note, even, onToggle, onNoteChange }: {
  label: string;
  done: boolean;
  note: string;
  even: boolean;
  onToggle: () => void;
  onNoteChange: (note: string) => void;
}) {
  const [localNote, setLocalNote] = useState(note);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocalNote(note); }, [note]);

  const handleNoteChange = (v: string) => {
    setLocalNote(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onNoteChange(v), 800);
  };

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-2.5 transition-colors',
      even && 'bg-muted/30',
    )}>
      <button
        onClick={onToggle}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
          done ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/30 hover:border-primary',
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </button>
      <span className={cn(
        'text-sm flex-shrink-0 w-44 truncate',
        done && 'line-through text-muted-foreground',
      )}>
        {label}
      </span>
      <Input
        value={localNote}
        onChange={e => handleNoteChange(e.target.value)}
        placeholder="Datum / Notiz"
        className="h-7 text-sm border-transparent focus:border-primary/30 bg-transparent"
      />
    </div>
  );
}
