import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveProject } from '@/hooks/useActiveProject';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Save, Calculator } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

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

  const [form, setForm] = useState({
    finance_type: 'leasing',
    term_months: 60,
    leasing_factor: 0.0186,
    margin_total: 0,
    old_rate: 0,
    old_remaining_months: 0,
    old_net_value: 0,
    total_hardware_ek: 0,
  });

  useEffect(() => {
    if (calc) {
      setForm({
        finance_type: calc.finance_type || 'leasing',
        term_months: calc.term_months || 60,
        leasing_factor: calc.leasing_factor || 0.0186,
        margin_total: calc.margin_total || 0,
        old_rate: calc.old_rate || 0,
        old_remaining_months: calc.old_remaining_months || 0,
        old_net_value: calc.old_net_value || 0,
        total_hardware_ek: calc.total_hardware_ek || 0,
      });
    }
  }, [calc]);

  const residualValue = (form.old_net_value * 0.03);
  const totalInvestment = form.total_hardware_ek + form.margin_total;
  const monthlyRate = totalInvestment * form.leasing_factor;

  const save = async () => {
    if (!activeProjectId) return;
    const payload = {
      project_id: activeProjectId,
      finance_type: form.finance_type,
      term_months: form.term_months,
      leasing_factor: form.leasing_factor,
      margin_total: form.margin_total,
      old_rate: form.old_rate,
      old_remaining_months: form.old_remaining_months,
      old_net_value: form.old_net_value,
      total_hardware_ek: form.total_hardware_ek,
      total_monthly_rate: monthlyRate,
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

  const numField = (label: string, key: keyof typeof form, suffix?: string) => (
    <div className="space-y-1">
      <Label className="text-xs font-heading">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="any"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
          className="text-sm h-9 pr-8"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
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
      <h1 className="text-2xl font-heading font-bold text-foreground">Kalkulation</h1>

      <Alert className="border-secondary/30 bg-secondary/5">
        <Info className="h-4 w-4 text-secondary" />
        <AlertDescription className="text-sm">
          Das Kalkulations-Modul wird in Phase 2 detailliert umgesetzt. Aktuell stehen Basisfunktionen zur Verfügung.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base">Finanzierung</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-heading">Finanzierungsart</Label>
                <Select value={form.finance_type} onValueChange={v => setForm(f => ({ ...f, finance_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leasing">Leasing</SelectItem>
                    <SelectItem value="miete">Miete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {numField('Laufzeit', 'term_months', 'Mon.')}
              {numField('Leasingfaktor', 'leasing_factor')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-base">Hardware & Marge</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {numField('Hardware EK gesamt', 'total_hardware_ek', '€')}
              {numField('Marge Hardware gesamt', 'margin_total', '€')}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-base">Ablöse Altvertrag</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {numField('Rate Alt', 'old_rate', '€')}
              {numField('Restmonate', 'old_remaining_months')}
              {numField('Warennettowert', 'old_net_value', '€')}
              <div className="space-y-1">
                <Label className="text-xs font-heading">Kalk. Restwert (3%)</Label>
                <Input value={residualValue.toFixed(2)} disabled className="text-sm h-9 bg-muted/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader><CardTitle className="font-heading text-base">Zusammenfassung</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Hardware EK</span>
                <span className="font-heading font-bold">{form.total_hardware_ek.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">+ Marge</span>
                <span className="font-heading font-bold">{form.margin_total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Gesamtinvestition</span>
                <span className="font-heading font-bold text-primary text-lg">{totalInvestment.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">× Leasingfaktor</span>
                <span className="font-heading font-bold">{form.leasing_factor}</span>
              </div>
              <div className="flex justify-between items-center bg-primary/5 rounded-lg p-3 -mx-1">
                <span className="text-sm font-semibold">Monatliche Rate</span>
                <span className="font-heading font-extrabold text-primary text-xl">{monthlyRate.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
              </div>
            </CardContent>
          </Card>

          <Button onClick={save} className="w-full gap-2 font-heading">
            <Save className="h-4 w-4" /> Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
