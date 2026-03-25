import { useState, useEffect, useCallback } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calculator, Save, Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import DeviceGroupCard, { type DeviceGroup } from '@/components/kalkulation/DeviceGroupCard';
import ServiceCard, { type ServiceConfig } from '@/components/kalkulation/ServiceCard';
import KalkSummary from '@/components/kalkulation/KalkSummary';

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
}

const defaultService: ServiceConfig = {
  colorProduct: null,
  bwProduct: null,
  colorVolume: 0,
  bwVolume: 0,
  colorPriceOverride: null,
  bwPriceOverride: null,
};

const createEmptyGroup = (): DeviceGroup => ({
  id: crypto.randomUUID(),
  device: null,
  accessories: [],
  quantity: 1,
  ekOverride: null,
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
  service: defaultService,
};

export default function KalkulationPage() {
  const { activeProjectId } = useActiveProject();
  const queryClient = useQueryClient();

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

  const [form, setForm] = useState<CalcState>(defaultState);

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
        service: cfg.service || defaultService,
      });
    } else {
      setForm(defaultState);
    }
  }, [calc]);

  // Computed values
  const residualValue = form.old_net_value * 0.03;
  const abloeseTotal = form.old_rate * form.old_remaining_months + residualValue;

  const hardwareEkTotal = form.deviceGroups.reduce((sum, g) => {
    const devicePrice = g.ekOverride ?? (g.device?.price || 0);
    const accTotal = g.accessories.reduce((s, a) => s + (a?.price || 0), 0);
    return sum + (devicePrice + accTotal) * g.quantity;
  }, 0);

  const serviceMonthly = (() => {
    const cp = form.service.colorPriceOverride ?? (form.service.colorProduct?.price || 0);
    const bp = form.service.bwPriceOverride ?? (form.service.bwProduct?.price || 0);
    return cp * form.service.colorVolume + bp * form.service.bwVolume;
  })();

  const save = async () => {
    if (!activeProjectId) return;

    const totalInvestment = hardwareEkTotal + form.margin_total;
    const investmentWithAbloese = totalInvestment + abloeseTotal;
    const monthlyRate =
      form.finance_type === 'leasing'
        ? investmentWithAbloese * form.leasing_factor
        : investmentWithAbloese / form.term_months;

    const payload = {
      project_id: activeProjectId,
      finance_type: form.finance_type,
      term_months: form.term_months,
      leasing_factor: form.leasing_factor,
      margin_total: form.margin_total,
      old_rate: form.old_rate,
      old_remaining_months: form.old_remaining_months,
      old_net_value: form.old_net_value,
      total_hardware_ek: hardwareEkTotal,
      total_monthly_rate: monthlyRate + serviceMonthly,
      service_rate: serviceMonthly,
      config_json: JSON.parse(JSON.stringify({
        contract_start: form.contract_start,
        delivery_date: form.delivery_date,
        deviceGroups: form.deviceGroups,
        service: form.service,
      })),
    };

    const { error } = calc
      ? await supabase.from('calculations').update(payload).eq('id', calc.id)
      : await supabase.from('calculations').insert(payload);

    if (error) toast.error('Speicherfehler: ' + error.message);
    else {
      toast.success('Kalkulation gespeichert');
      queryClient.invalidateQueries({ queryKey: ['calculation', activeProjectId] });
    }
  };

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

  const numField = (label: string, key: keyof CalcState, opts?: { suffix?: string; step?: string; disabled?: boolean }) => (
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

  const DateField = ({ label, value, onChange: onDateChange }: { label: string; value: string | null; onChange: (d: string | null) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal h-9 text-sm', !value && 'text-muted-foreground')}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-foreground">Kalkulation</h1>
        <Button onClick={save} className="gap-2 font-heading">
          <Save className="h-4 w-4" /> Speichern
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column – 60% */}
        <div className="lg:col-span-3 space-y-4">
          {/* Karte 1: Finanzierung & Rahmendaten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Finanzierung & Rahmendaten</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Finanzierungsart</Label>
                <Select value={form.finance_type} onValueChange={(v) => setForm((f) => ({ ...f, finance_type: v }))}>
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

          {/* Karte 3: Ablöse Altvertrag */}
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

          {/* Gerätegruppen */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-foreground">Gerätegruppen</h2>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setForm((f) => ({ ...f, deviceGroups: [...f.deviceGroups, createEmptyGroup()] }))}
              >
                <Plus className="h-3.5 w-3.5" /> Gruppe hinzufügen
              </Button>
            </div>
            {form.deviceGroups.map((g, i) => (
              <DeviceGroupCard
                key={g.id}
                group={g}
                index={i}
                onChange={(updated) => updateGroup(i, updated)}
                onRemove={() => removeGroup(i)}
              />
            ))}
          </div>

          {/* Service */}
          <ServiceCard config={form.service} onChange={(s) => setForm((f) => ({ ...f, service: s }))} />
        </div>

        {/* Right column – 40% */}
        <div className="lg:col-span-2">
          <KalkSummary
            financeType={form.finance_type}
            termMonths={form.term_months}
            leasingFactor={form.leasing_factor}
            hardwareEkTotal={hardwareEkTotal}
            marginTotal={form.margin_total}
            abloeseTotal={abloeseTotal}
            serviceMonthly={serviceMonthly}
          />
          <Button onClick={save} className="w-full gap-2 font-heading mt-4">
            <Save className="h-4 w-4" /> Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
