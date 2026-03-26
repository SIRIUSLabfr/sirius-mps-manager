import { useState, useEffect } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useZoho } from '@/hooks/useZoho';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calculator, Save, Plus, CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import DeviceGroupCard, {
  type DeviceGroup,
  type AccessoryItem,
  calcGroupEk,
} from '@/components/kalkulation/DeviceGroupCard';
import ServiceCard, {
  type ServiceConfig,
  type ServiceItem,
  calcServiceRate,
  calcServiceVolumes,
} from '@/components/kalkulation/ServiceCard';
import KalkSummary from '@/components/kalkulation/KalkSummary';
import IstBestandsAnalyse from '@/components/kalkulation/IstBestandsAnalyse';

interface CalcState {
  finance_type: string;
  term_months: number;
  leasing_factor: number;
  margin_total: number;
  old_rate: number;
  old_remaining_months: number;
  old_net_value: number;
  contract_start: string | null;
  delivery_date: string | null;
  deviceGroups: DeviceGroup[];
  service: ServiceConfig;
  followBw: number;
  followColor: number;
}

const createEmptyGroup = (): DeviceGroup => ({
  id: crypto.randomUUID(),
  label: '',
  mainDevice: null,
  mainQuantity: 1,
  accessories: [],
});

const createEmptyServiceItem = (): ServiceItem => ({
  id: crypto.randomUUID(),
  product: null,
  quantity: 1000,
});

const defaultState: CalcState = {
  finance_type: 'leasing',
  term_months: 60,
  leasing_factor: 0.0186,
  margin_total: 0,
  old_rate: 0,
  old_remaining_months: 0,
  old_net_value: 0,
  contract_start: null,
  delivery_date: null,
  deviceGroups: [createEmptyGroup()],
  service: { items: [createEmptyServiceItem()] },
  followBw: 0,
  followColor: 0,
};

export default function KalkulationPage() {
  const { activeProjectId } = useActiveProject();
  const { ZOHO, dealId } = useZoho();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CalcState>(defaultState);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load from Supabase
  const { data: calc } = useQuery({
    queryKey: ['calculation', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return null;
      const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('project_id', activeProjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeProjectId,
  });

  // State restore
  useEffect(() => {
    if (calc) {
      const cfg = (calc.config_json as any) || {};
      setForm({
        finance_type: calc.finance_type || 'leasing',
        term_months: calc.term_months || 60,
        leasing_factor: calc.leasing_factor || 0.0186,
        margin_total: calc.margin_total || 0,
        old_rate: calc.old_rate || 0,
        old_remaining_months: calc.old_remaining_months || 0,
        old_net_value: calc.old_net_value || 0,
        contract_start: cfg.contract_start || null,
        delivery_date: cfg.delivery_date || null,
        deviceGroups: cfg.deviceGroups?.length ? cfg.deviceGroups : [createEmptyGroup()],
        service: cfg.service?.items ? cfg.service : { items: [createEmptyServiceItem()] },
        followBw: cfg.followBw || 0,
        followColor: cfg.followColor || 0,
      });
    } else if (!calc && activeProjectId && ZOHO?.CRM?.API && dealId) {
      // Fallback: try Zoho Deal field
      ZOHO.CRM.API.getRecord({ Entity: 'Deals', RecordID: dealId })
        .then((resp: any) => {
          const deal = resp?.data?.[0];
          const raw = deal?.MPS_Config_JSON;
          if (raw) {
            try {
              const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
              setForm((prev) => ({
                ...prev,
                ...cfg,
                deviceGroups: cfg.deviceGroups?.length ? cfg.deviceGroups : [createEmptyGroup()],
                service: cfg.service?.items ? cfg.service : { items: [createEmptyServiceItem()] },
              }));
              toast.info('Daten aus Zoho Deal importiert');
            } catch { /* ignore parse errors */ }
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [calc, activeProjectId, ZOHO, dealId]);

  // Computed
  const residualValue = form.old_net_value * 0.03;
  const abloeseTotal = form.old_rate * form.old_remaining_months + residualValue;
  const hardwareEkTotal = form.deviceGroups.reduce((s, g) => s + calcGroupEk(g), 0);
  const serviceMonthly = calcServiceRate(form.service);
  const volumes = calcServiceVolumes(form.service);
  const investTotal = hardwareEkTotal + form.margin_total + abloeseTotal;
  const hwMonthly =
    form.finance_type === 'leasing'
      ? investTotal * form.leasing_factor
      : investTotal / form.term_months;
  const totalRate = hwMonthly + serviceMonthly;

  const buildPayload = () => ({
    project_id: activeProjectId!,
    finance_type: form.finance_type,
    term_months: form.term_months,
    leasing_factor: form.leasing_factor,
    margin_total: form.margin_total,
    old_rate: form.old_rate,
    old_remaining_months: form.old_remaining_months,
    old_net_value: form.old_net_value,
    total_hardware_ek: hardwareEkTotal,
    total_monthly_rate: totalRate,
    service_rate: serviceMonthly,
    config_json: JSON.parse(
      JSON.stringify({
        contract_start: form.contract_start,
        delivery_date: form.delivery_date,
        deviceGroups: form.deviceGroups,
        service: form.service,
        followBw: form.followBw,
        followColor: form.followColor,
      })
    ),
  });

  const saveToSupabase = async () => {
    if (!activeProjectId) return false;
    const payload = buildPayload();
    const { error } = calc
      ? await supabase.from('calculations').update(payload).eq('id', calc.id)
      : await supabase.from('calculations').insert(payload);
    if (error) {
      setStatusMsg({ type: 'error', text: 'Speicherfehler: ' + error.message });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ['calculation', activeProjectId] });
    return true;
  };

  const saveToZoho = async () => {
    if (!ZOHO?.CRM?.API || !dealId) return;
    try {
      await ZOHO.CRM.API.updateRecord({
        Entity: 'Deals',
        RecordID: dealId,
        APIData: { id: dealId, MPS_Config_JSON: JSON.stringify(buildPayload().config_json) },
        Trigger: [],
      });
    } catch { /* non-critical */ }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    const ok = await saveToSupabase();
    if (ok) {
      await saveToZoho();
      setStatusMsg({ type: 'success', text: 'Erfolgreich gespeichert' });
    }
    setSaving(false);
  };

  const handleCreateEstimate = async () => {
    setCreating(true);
    setStatusMsg(null);
    const ok = await saveToSupabase();
    if (!ok) {
      setCreating(false);
      return;
    }
    await saveToZoho();
    if (!ZOHO?.CRM?.FUNCTIONS || !dealId) {
      setStatusMsg({ type: 'error', text: 'Zoho nicht verfügbar' });
      setCreating(false);
      return;
    }
    try {
      const mpsPayload = {
        ...buildPayload(),
        hardwareEkTotal,
        serviceMonthly,
        abloeseTotal,
        hwMonthly,
        totalRate,
        volumes,
      };
      await ZOHO.CRM.FUNCTIONS.execute('createMpsEstimateAdvanced', {
        arguments: JSON.stringify({
          potentialId: dealId,
          mpsFullData: mpsPayload,
        }),
      });
      setStatusMsg({ type: 'success', text: 'Angebot erstellt' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Angebotsfehler: ' + (err?.message || 'Unbekannt') });
    }
    setCreating(false);
  };

  // Helpers
  const numField = (
    label: string,
    key: keyof CalcState,
    opts?: { suffix?: string; step?: string; disabled?: boolean }
  ) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={opts?.step || 'any'}
          value={form[key] as number}
          onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
          disabled={opts?.disabled}
          className={cn('text-sm h-9', opts?.suffix && 'pr-8', opts?.disabled && 'bg-muted/30')}
        />
        {opts?.suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {opts.suffix}
          </span>
        )}
      </div>
    </div>
  );

  const DateField = ({
    label,
    value,
    onChange: onDateChange,
  }: {
    label: string;
    value: string | null;
    onChange: (d: string | null) => void;
  }) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-9 text-sm',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value ? format(new Date(value), 'dd.MM.yyyy') : 'Datum wählen'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(d) => onDateChange(d ? d.toISOString().split('T')[0] : null)}
            locale={de}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  if (!activeProjectId) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Wähle zuerst ein Projekt aus der Projektübersicht.</p>
      </div>
    );
  }

  const updateGroup = (index: number, group: DeviceGroup) => {
    setForm((f) => {
      const groups = [...f.deviceGroups];
      groups[index] = group;
      return { ...f, deviceGroups: groups };
    });
  };

  const removeGroup = (index: number) => {
    setForm((f) => ({
      ...f,
      deviceGroups: f.deviceGroups.length > 1 ? f.deviceGroups.filter((_, i) => i !== index) : f.deviceGroups,
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold text-foreground">Kalkulation</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column – 60% */}
        <div className="lg:col-span-3 space-y-4">
          {/* IST-Bestandsanalyse (collapsible) */}
          <IstBestandsAnalyse
            projectId={activeProjectId}
            deviceGroups={form.deviceGroups}
            totalRate={totalRate}
          />

          {/* Karte 1: Finanzierung */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Finanzierung & Rahmendaten</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Finanzierungsart</Label>
                <Select
                  value={form.finance_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, finance_type: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leasing">Leasing (Bank)</SelectItem>
                    <SelectItem value="miete">Miete (Eigen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {numField('Laufzeit (Monate)', 'term_months', { step: '1' })}
              {numField('Marge (Hardware Gesamt) €', 'margin_total', { suffix: '€', step: '50' })}
              {form.finance_type === 'leasing' &&
                numField('Leasingfaktor', 'leasing_factor', { step: '0.0001' })}
            </CardContent>
          </Card>

          {/* Karte 2: Vertragsdetails */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Vertragsdetails</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateField
                label="Vertragsstart"
                value={form.contract_start}
                onChange={(d) => setForm((f) => ({ ...f, contract_start: d }))}
              />
              <DateField
                label="Lieferung"
                value={form.delivery_date}
                onChange={(d) => setForm((f) => ({ ...f, delivery_date: d }))}
              />
            </CardContent>
          </Card>

          {/* Karte 3: Ablöse */}
          <Card className="border-l-4 border-l-orange-400">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base">Ablöse Altvertrag</CardTitle>
                <span className="text-sm font-semibold text-orange-600">
                  {abloeseTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {numField('Rate Alt (€)', 'old_rate', { suffix: '€' })}
              {numField('Restmonate', 'old_remaining_months', { step: '1' })}
              {numField('Warennettowert (Ursprung) €', 'old_net_value', { suffix: '€' })}
              <div className="space-y-1">
                <Label className="text-xs font-heading">Kalk. Restwert (3%)</Label>
                <Input
                  value={residualValue.toFixed(2)}
                  disabled
                  className="text-sm h-9 bg-muted/30 pr-8"
                />
                <span className="text-[10px] text-muted-foreground">= Warennettowert × 3%</span>
              </div>
            </CardContent>
          </Card>

          {/* Karte 4: Gerätegruppen */}
          <div className="space-y-3">
            {form.deviceGroups.map((g, i) => (
              <DeviceGroupCard
                key={g.id}
                group={g}
                onChange={(updated) => updateGroup(i, updated)}
                onRemove={() => removeGroup(i)}
              />
            ))}
            <Button
              variant="outline"
              className="w-full h-11 border-foreground/30 font-heading text-xs uppercase tracking-wider gap-2"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  deviceGroups: [...f.deviceGroups, createEmptyGroup()],
                }))
              }
            >
              <Plus className="h-4 w-4" /> Neuen Standort / Gerät hinzufügen
            </Button>
          </div>

          {/* Karte 5: Service */}
          <ServiceCard
            config={form.service}
            onChange={(s) => setForm((f) => ({ ...f, service: s }))}
          />
        </div>

        {/* Right column – 40% */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4 space-y-4">
          <KalkSummary
            financeType={form.finance_type}
            termMonths={form.term_months}
            leasingFactor={form.leasing_factor}
            hardwareEkTotal={hardwareEkTotal}
            marginTotal={form.margin_total}
            abloeseTotal={abloeseTotal}
            serviceMonthly={serviceMonthly}
            volumeBw={volumes.bw}
            volumeColor={volumes.color}
            followBw={form.followBw}
            followColor={form.followColor}
            onFollowBwChange={(v) => setForm((f) => ({ ...f, followBw: v }))}
            onFollowColorChange={(v) => setForm((f) => ({ ...f, followColor: v }))}
          />

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 font-heading border-foreground/30"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Zwischenspeichern
              </Button>
              <Button
                className="flex-1 gap-2 font-heading bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg"
                onClick={handleCreateEstimate}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Angebot erstellen
              </Button>
            </div>
            {statusMsg && (
              <p
                className={cn(
                  'text-xs text-center font-medium',
                  statusMsg.type === 'success' ? 'text-green-600' : 'text-destructive'
                )}
              >
                {statusMsg.text}
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
