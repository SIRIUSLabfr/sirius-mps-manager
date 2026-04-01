import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useActiveProject } from '@/hooks/useActiveProject';
import { useZoho } from '@/hooks/useZoho';
import { zohoClient } from '@/lib/zohoClient';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Save, Plus, CalendarIcon, FileText, Loader2, BookmarkPlus, Download, GitCompareArrows, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import DeviceGroupCard, {
  type DeviceGroup,
  type PagePrices,
  calcGroupEk,
} from '@/components/kalkulation/DeviceGroupCard';
import type { ZohoProduct } from '@/components/kalkulation/ZohoProductSearch';
import ServiceCard, {
  type ServiceConfig,
  type ServiceItem,
  calcMixServiceCosts,
  calcMixServiceVolumes,
} from '@/components/kalkulation/ServiceCard';
import KalkSummary from '@/components/kalkulation/KalkSummary';
import IstBestandsAnalyse from '@/components/kalkulation/IstBestandsAnalyse';
import TemplateDialog from '@/components/kalkulation/TemplateDialog';
import ScenarioCompare from '@/components/kalkulation/ScenarioCompare';

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
  folgeseitenpreis_sw: number;
  folgeseitenpreis_farbe: number;
}

const createEmptyPagePrices = (): PagePrices => ({ bw: null, color: null });

const createEmptyGroup = (): DeviceGroup => ({
  id: crypto.randomUUID(),
  label: '',
  mainDevice: null,
  mainQuantity: 1,
  accessories: [],
  page_prices: createEmptyPagePrices(),
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
  service: { items: [] },
  folgeseitenpreis_sw: 0,
  folgeseitenpreis_farbe: 0,
};

export default function KalkulationPage() {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const { activeProjectId, setActiveProjectId } = useActiveProject();
  const { dealId } = useZoho();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (urlProjectId) setActiveProjectId(urlProjectId);
  }, [urlProjectId, setActiveProjectId]);

  const [form, setForm] = useState<CalcState>(defaultState);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeCalcId, setActiveCalcId] = useState<string | null>(null);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateLoadOpen, setTemplateLoadOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  // Load locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data } = await supabase
        .from('locations')
        .select('id, name')
        .eq('project_id', activeProjectId)
        .order('sort_order');
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  // Load ALL scenarios for this project
  const { data: allCalcs = [] } = useQuery({
    queryKey: ['calculations_all', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const { data } = await supabase
        .from('calculations')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('created_at');
      return data || [];
    },
    enabled: !!activeProjectId,
  });

  // Select active scenario
  useEffect(() => {
    if (allCalcs.length > 0 && !activeCalcId) {
      const active = allCalcs.find((c: any) => c.is_active) || allCalcs[0];
      setActiveCalcId(active.id);
    }
  }, [allCalcs, activeCalcId]);

  const activeCalc = allCalcs.find((c: any) => c.id === activeCalcId) || null;

  // State restore from active calc
  useEffect(() => {
    if (activeCalc) {
      const cfg = (activeCalc.config_json as any) || {};
      const restoreGroups = (groups: any[]) =>
        groups.map((g: any) => ({
          ...g,
          page_prices: g.page_prices || createEmptyPagePrices(),
        }));
      setForm({
        finance_type: activeCalc.finance_type || 'leasing',
        term_months: activeCalc.term_months || 60,
        leasing_factor: activeCalc.leasing_factor || 0.0186,
        margin_total: activeCalc.margin_total || 0,
        old_rate: activeCalc.old_rate || 0,
        old_remaining_months: activeCalc.old_remaining_months || 0,
        old_net_value: activeCalc.old_net_value || 0,
        contract_start: cfg.contract_start || null,
        delivery_date: cfg.delivery_date || null,
        deviceGroups: cfg.device_groups?.length
          ? restoreGroups(cfg.device_groups)
          : cfg.deviceGroups?.length
            ? restoreGroups(cfg.deviceGroups)
            : [createEmptyGroup()],
        service: cfg.mix_service_items
          ? { items: cfg.mix_service_items }
          : cfg.service?.items
            ? cfg.service
            : { items: [] },
      });
    }
  }, [activeCalc, allCalcs.length, activeProjectId]);

  // ===== COMPUTED VALUES =====
  const residualValue = form.old_net_value * 0.03;
  const abloeseTotal = form.old_rate * form.old_remaining_months + residualValue;
  const hardwareEkTotal = form.deviceGroups.reduce((s, g) => s + calcGroupEk(g), 0);
  const investTotal = hardwareEkTotal + form.margin_total + abloeseTotal;
  const hwMonthly =
    form.finance_type === 'leasing' || form.finance_type === 'all_in'
      ? investTotal * form.leasing_factor
      : form.finance_type === 'kauf_wv'
        ? 0
        : form.term_months > 0 ? investTotal / form.term_months : 0;

  const groupPageData = useMemo(() => {
    let swCost = 0, swVol = 0, colorCost = 0, colorVol = 0;
    for (const g of form.deviceGroups) {
      const pp = g.page_prices;
      if (pp?.bw) { swCost += pp.bw.price * pp.bw.volume; swVol += pp.bw.volume; }
      if (pp?.color) { colorCost += pp.color.price * pp.color.volume; colorVol += pp.color.volume; }
    }
    return { swCost, swVol, colorCost, colorVol };
  }, [form.deviceGroups]);

  const mixData = useMemo(() => {
    const costs = calcMixServiceCosts(form.service);
    const vols = calcMixServiceVolumes(form.service);
    return { ...costs, ...vols };
  }, [form.service]);

  const mischklick = useMemo(() => {
    const totalSwCost = groupPageData.swCost + mixData.bwCost;
    const totalSwVolume = groupPageData.swVol + mixData.bw;
    const totalColorCost = groupPageData.colorCost + mixData.colorCost;
    const totalColorVolume = groupPageData.colorVol + mixData.color;
    const totalServiceRate = totalSwCost + totalColorCost;
    return {
      totalSwCost, totalSwVolume,
      mischklickSw: totalSwVolume > 0 ? totalSwCost / totalSwVolume : 0,
      totalColorCost, totalColorVolume,
      mischklickColor: totalColorVolume > 0 ? totalColorCost / totalColorVolume : 0,
      totalServiceRate,
    };
  }, [groupPageData, mixData]);

  const totalRate = hwMonthly + mischklick.totalServiceRate;

  // ===== PAYLOAD =====
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
    service_rate: mischklick.totalServiceRate,
    config_json: JSON.parse(JSON.stringify({
      contract_start: form.contract_start,
      delivery_date: form.delivery_date,
      device_groups: form.deviceGroups,
      mix_service_items: form.service.items,
      calculated: {
        total_ek: hardwareEkTotal,
        buyout_total: abloeseTotal,
        invest_total: investTotal,
        hw_monthly: hwMonthly,
        srv_rate: mischklick.totalServiceRate,
        total_rate: totalRate,
        total_volume_bw: mischklick.totalSwVolume,
        total_volume_color: mischklick.totalColorVolume,
        mischklick_bw: mischklick.mischklickSw,
        mischklick_color: mischklick.mischklickColor,
      },
    })),
  });

  const saveToSupabase = async () => {
    if (!activeProjectId) return false;
    const payload = buildPayload();
    if (activeCalcId) {
      const { error } = await supabase.from('calculations').update(payload).eq('id', activeCalcId);
      if (error) { setStatusMsg({ type: 'error', text: 'Speicherfehler: ' + error.message }); return false; }
    } else {
      const { data, error } = await supabase.from('calculations').insert({ ...payload, is_active: allCalcs.length === 0 }).select().single();
      if (error) { setStatusMsg({ type: 'error', text: 'Speicherfehler: ' + error.message }); return false; }
      setActiveCalcId(data.id);
    }
    queryClient.invalidateQueries({ queryKey: ['calculations_all', activeProjectId] });
    return true;
  };

  const { isZohoConnected, connectZoho } = useZoho();

  const handleSave = async () => {
    setSaving(true); setStatusMsg(null);
    const ok = await saveToSupabase();
    if (ok) {
      // Write-back to Zoho if connected
      if (isZohoConnected && dealId) {
        try {
          await zohoClient.updateDeal(dealId, {
            MPS_Monatliche_Rate: totalRate,
            MPS_Geraeteanzahl: form.deviceGroups.reduce((s, g) => s + g.mainQuantity, 0),
            MPS_Laufzeit_Monate: form.term_months,
            MPS_Finanzierungsart: form.finance_type,
          });
        } catch (e) {
          console.warn('Zoho Write-Back fehlgeschlagen:', e);
        }
      }
      setStatusMsg({ type: 'success', text: 'Erfolgreich gespeichert' });
    }
    setSaving(false);
  };

  const handleCreateEstimate = async () => {
    if (!isZohoConnected) {
      connectZoho();
      return;
    }
    if (!dealId) {
      setStatusMsg({ type: 'error', text: 'Keine Deal-ID vorhanden. App mit ?deal_id=... öffnen.' });
      return;
    }
    setCreating(true); setStatusMsg(null);
    const ok = await saveToSupabase();
    if (!ok) { setCreating(false); return; }

    try {
      const payload = buildPayload();
      const cfg = payload.config_json as any;
      const c = cfg.calculated;
      const groups = cfg.device_groups || [];

      const fmt2 = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmt4d = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

      // Build line items
      const lineItems: any[] = [];
      groups.forEach((group: any) => {
        lineItems.push({ Product_Description: `── STANDORT: ${group.label || 'Unbenannt'} ──`, quantity: 0, list_price: 0, Discount: 0, net_total: 0 });
        if (group.mainDevice?.name) {
          lineItems.push({ product: group.mainDevice.id && !group.mainDevice.id.startsWith('manual-') ? { id: group.mainDevice.id } : undefined, Product_Description: group.mainDevice.name, quantity: group.mainQuantity || 1, list_price: group.mainDevice.price || 0, Discount: 0 });
        }
        (group.accessories || []).forEach((acc: any) => {
          if (acc.product?.name) {
            lineItems.push({ product: acc.product.id && !acc.product.id.startsWith('manual-') ? { id: acc.product.id } : undefined, Product_Description: acc.product.name, quantity: acc.quantity || 1, list_price: acc.product.price || 0, Discount: 0 });
          }
        });
        const pp = group.page_prices;
        if (pp?.bw) lineItems.push({ Product_Description: `Seitenpreis S/W (${pp.bw.volume?.toLocaleString('de-DE')} S/M)`, quantity: pp.bw.volume || 0, list_price: pp.bw.price || 0, Discount: 0 });
        if (pp?.color) lineItems.push({ Product_Description: `Seitenpreis Farbe (${pp.color.volume?.toLocaleString('de-DE')} S/M)`, quantity: pp.color.volume || 0, list_price: pp.color.price || 0, Discount: 0 });
      });

      // Summary description
      const financeLabels: Record<string, string> = { leasing: 'Leasing (Bank)', miete: 'Miete (Eigen)', eigenmiete: 'Eigenmiete (SIRIUS)', kauf_wv: 'Kauf + Wartungsvertrag', all_in: 'All-In-Vertrag' };
      const summaryLines = [
        'ZUSAMMENFASSUNG',
        `Gesamtvolumen S/W: ${c.total_volume_bw?.toLocaleString('de-DE')} S/M`,
        `Gesamtvolumen Farbe: ${c.total_volume_color?.toLocaleString('de-DE')} S/M`,
        `Mischklick S/W: ${fmt4d(c.mischklick_bw || 0)} €`,
        `Mischklick Farbe: ${fmt4d(c.mischklick_color || 0)} €`,
        `Vertragsart: ${financeLabels[form.finance_type] || form.finance_type}`,
        `Laufzeit: ${form.term_months} Monate`,
        `Monatliche Rate: ${fmt2(c.total_rate || 0)} €`,
      ];

      const quotePayload = {
        data: [{
          Subject: `MPS Kostenvoranschlag`,
          Deal_Name: { id: dealId },
          Valid_Till: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          Description: summaryLines.join('\n'),
          Terms_and_Conditions: `Laufzeit: ${form.term_months} Monate ab Lieferung. Preise zzgl. MwSt.`,
          Quoted_Items: lineItems,
        }],
      };

      const result = await zohoClient.createQuote(quotePayload);
      if (result?.data?.[0]?.status === 'success') {
        toast.success('Kostenvoranschlag in Zoho CRM erstellt!');
        // Update deal fields
        await zohoClient.updateDeal(dealId, {
          MPS_Monatliche_Rate: c.total_rate,
          MPS_Geraeteanzahl: groups.reduce((s: number, g: any) => s + (g.mainQuantity || 1), 0),
          MPS_Laufzeit_Monate: form.term_months,
          MPS_Finanzierungsart: form.finance_type,
          MPS_Volumen_SW: c.total_volume_bw,
          MPS_Volumen_Farbe: c.total_volume_color,
          MPS_Mischklick_SW: c.mischklick_bw,
          MPS_Mischklick_Farbe: c.mischklick_color,
        });
        setStatusMsg({ type: 'success', text: 'Kostenvoranschlag erstellt!' });
      } else {
        setStatusMsg({ type: 'error', text: 'Fehler beim Erstellen: ' + JSON.stringify(result) });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Fehler: ' + (e.message || e) });
    }
    setCreating(false);
  };

  // ===== SCENARIO ACTIONS =====
  const handleNewScenario = async (copyFrom?: boolean) => {
    if (!activeProjectId) return;
    const payload = copyFrom ? { ...buildPayload(), label: `Szenario ${allCalcs.length + 1}`, is_active: false } : {
      project_id: activeProjectId,
      label: `Szenario ${allCalcs.length + 1}`,
      is_active: false,
      finance_type: 'leasing',
      term_months: 60,
      leasing_factor: 0.0186,
      margin_total: 0,
      old_rate: 0,
      old_remaining_months: 0,
      old_net_value: 0,
      total_hardware_ek: 0,
      total_monthly_rate: 0,
      service_rate: 0,
      config_json: {} as any,
    };
    const { data, error } = await supabase.from('calculations').insert(payload).select().single();
    if (error) { toast.error('Fehler: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['calculations_all', activeProjectId] });
    setActiveCalcId(data.id);
    toast.success('Neues Szenario erstellt');
  };

  const handleActivateScenario = async (id: string) => {
    if (!activeProjectId) return;
    // Deactivate all, activate selected
    await supabase.from('calculations').update({ is_active: false }).eq('project_id', activeProjectId);
    await supabase.from('calculations').update({ is_active: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['calculations_all', activeProjectId] });
    toast.success('Szenario aktiviert');
  };

  const handleTemplateLoad = (cfg: { finance_type: string; term_months: number; leasing_factor: number; margin_total: number }) => {
    setForm(f => ({ ...f, ...cfg }));
  };

  // ===== HELPERS =====
  const numField = (label: string, key: keyof CalcState, opts?: { suffix?: string; step?: string; disabled?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <div className="relative">
        <Input
          type="number" step={opts?.step || 'any'}
          value={form[key] as number}
          onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
          disabled={opts?.disabled}
          className={cn('text-sm h-9', opts?.suffix && 'pr-8', opts?.disabled && 'bg-muted/30')}
        />
        {opts?.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{opts.suffix}</span>}
      </div>
    </div>
  );

  const DateField = ({ label, value, onChange: onDateChange }: { label: string; value: string | null; onChange: (d: string | null) => void }) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-9 text-sm', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {value ? format(new Date(value), 'dd.MM.yyyy') : 'Datum wählen'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value ? new Date(value) : undefined} onSelect={(d) => onDateChange(d ? d.toISOString().split('T')[0] : null)} locale={de} className="p-3 pointer-events-auto" />
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
    setForm((f) => { const groups = [...f.deviceGroups]; groups[index] = group; return { ...f, deviceGroups: groups }; });
  };
  const removeGroup = (index: number) => {
    setForm((f) => ({ ...f, deviceGroups: f.deviceGroups.length > 1 ? f.deviceGroups.filter((_, i) => i !== index) : f.deviceGroups }));
  };

  const handleSollAssigned = (istDevice: any, product: ZohoProduct) => {
    const locationStr = [istDevice.building, istDevice.location, istDevice.floor ? `Etage ${istDevice.floor}` : '', istDevice.room ? `Raum ${istDevice.room}` : ''].filter(Boolean).join(', ');
    const newGroup: DeviceGroup = {
      id: crypto.randomUUID(), label: locationStr || istDevice.location || '',
      mainDevice: product, mainQuantity: istDevice.count || 1,
      accessories: [], page_prices: createEmptyPagePrices(),
    };
    setForm((f) => ({ ...f, deviceGroups: [...f.deviceGroups.filter(g => g.mainDevice !== null || f.deviceGroups.length === 1), newGroup] }));
    toast.success(`${product.name} als SOLL-Gerät hinzugefügt`);
  };

  const scenarioLabel = (c: any, i: number) => c.label || `Szenario ${i + 1}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-heading font-bold text-foreground">Kalkulation</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setTemplateLoadOpen(true)}>
            <Download className="h-3.5 w-3.5" /> Vorlage laden
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setTemplateSaveOpen(true)}>
            <BookmarkPlus className="h-3.5 w-3.5" /> Als Vorlage
          </Button>
          {allCalcs.length >= 2 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCompareOpen(!compareOpen)}>
              <GitCompareArrows className="h-3.5 w-3.5" /> Vergleichen
            </Button>
          )}
        </div>
      </div>

      {/* Scenario tabs */}
      {allCalcs.length > 0 && (
        <div className="flex items-center gap-2">
          <Tabs value={activeCalcId || ''} onValueChange={setActiveCalcId} className="flex-1">
            <TabsList className="h-9">
              {allCalcs.map((c: any, i: number) => (
                <TabsTrigger key={c.id} value={c.id} className="text-xs gap-1.5 data-[state=active]:shadow-sm">
                  {scenarioLabel(c, i)}
                  {c.is_active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => handleNewScenario(false)}>
                <Plus className="h-3.5 w-3.5" /> Leeres Szenario
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs gap-2" onClick={() => handleNewScenario(true)}>
                <Copy className="h-3.5 w-3.5" /> Aktuelles kopieren
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Comparison view */}
      {compareOpen && allCalcs.length >= 2 && (
        <ScenarioCompare
          scenarios={allCalcs as any}
          onActivate={handleActivateScenario}
          onClose={() => setCompareOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left column – 60% */}
        <div className="lg:col-span-3 space-y-4">
          <IstBestandsAnalyse
            projectId={activeProjectId}
            deviceGroups={form.deviceGroups}
            totalRate={totalRate}
            onSollAssigned={handleSollAssigned}
          />

          {/* Finanzierung & Rahmendaten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-heading text-base">Finanzierung & Rahmendaten</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Finanzierungsart</Label>
                <Select value={form.finance_type} onValueChange={(v) => setForm((f) => ({ ...f, finance_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leasing">Leasing (Bank)</SelectItem>
                    <SelectItem value="eigenmiete">Eigenmiete (SIRIUS)</SelectItem>
                    <SelectItem value="kauf_wv">Kauf + Wartungsvertrag</SelectItem>
                    <SelectItem value="all_in">All-In-Vertrag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {numField('Laufzeit (Monate)', 'term_months', { step: '1' })}
              {numField('Marge (Hardware Gesamt) €', 'margin_total', { suffix: '€', step: '50' })}
              {(form.finance_type === 'leasing' || form.finance_type === 'all_in') && numField('Leasingfaktor', 'leasing_factor', { step: '0.0001' })}
              <DateField label="Vertragsstart" value={form.contract_start} onChange={(d) => setForm((f) => ({ ...f, contract_start: d }))} />
              <DateField label="Lieferung" value={form.delivery_date} onChange={(d) => setForm((f) => ({ ...f, delivery_date: d }))} />
            </CardContent>
          </Card>

          {/* Ablöse Altvertrag */}
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
                <Input value={residualValue.toFixed(2)} disabled className="text-sm h-9 bg-muted/30 pr-8" />
                <span className="text-[10px] text-muted-foreground">= Warennettowert × 3%</span>
              </div>
            </CardContent>
          </Card>

          {/* Hardware-Konfiguration */}
          <div className="space-y-3">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground">Hardware-Konfiguration</h2>
            {form.deviceGroups.map((g, i) => (
              <DeviceGroupCard key={g.id} group={g} onChange={(updated) => updateGroup(i, updated)} onRemove={() => removeGroup(i)} locations={locations.length > 0 ? locations : undefined} />
            ))}
            <Button variant="outline" className="w-full h-11 border-foreground/30 font-heading text-xs uppercase tracking-wider gap-2" onClick={() => setForm((f) => ({ ...f, deviceGroups: [...f.deviceGroups, createEmptyGroup()] }))}>
              <Plus className="h-4 w-4" /> Neuen Standort / Gerät hinzufügen
            </Button>
          </div>

          {/* Mischkalkulation */}
          <ServiceCard config={form.service} onChange={(s) => setForm((f) => ({ ...f, service: s }))} mischklick={mischklick} />
        </div>

        {/* Right column – 40% (sticky) */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4 space-y-4">
            <KalkSummary
              financeType={form.finance_type} termMonths={form.term_months} leasingFactor={form.leasing_factor}
              hardwareEkTotal={hardwareEkTotal} marginTotal={form.margin_total} abloeseTotal={abloeseTotal}
              hwMonthly={hwMonthly} totalRate={totalRate} mischklick={mischklick}
            />
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 font-heading border-foreground/30" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Zwischenspeichern
                </Button>
                <Button
                  className="flex-1 gap-2 font-heading shadow-lg"
                  style={{ backgroundColor: isZohoConnected ? '#00A3E0' : undefined }}
                  variant={isZohoConnected ? 'default' : 'outline'}
                  onClick={handleCreateEstimate}
                  disabled={creating}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {creating ? 'Wird erstellt…' : isZohoConnected ? 'Angebot erstellen' : 'Zoho verbinden für Angebot'}
                </Button>
              </div>
              {statusMsg && (
                <p className={cn('text-xs text-center font-medium', statusMsg.type === 'success' ? 'text-green-600' : 'text-destructive')}>
                  {statusMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Template dialogs */}
      <TemplateDialog mode="save" open={templateSaveOpen} onOpenChange={setTemplateSaveOpen} currentConfig={form} />
      <TemplateDialog mode="load" open={templateLoadOpen} onOpenChange={setTemplateLoadOpen} onLoad={handleTemplateLoad} />
    </div>
  );
}
