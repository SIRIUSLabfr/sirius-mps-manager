import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Package, Printer, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useZoho } from '@/hooks/useZoho';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProjectType = 'project' | 'daily' | null;

export default function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const queryClient = useQueryClient();
  const { ZOHO, dealId } = useZoho();
  const [selectedType, setSelectedType] = useState<ProjectType>(null);

  // MPS Project form
  const [form, setForm] = useState({
    customer_name: '',
    project_number: '',
    project_name: '',
    warehouse_address: '',
    zoho_deal_id: '',
  });
  const [rolloutStart, setRolloutStart] = useState<Date | undefined>();
  const [rolloutEnd, setRolloutEnd] = useState<Date | undefined>();

  // Daily form
  const [dailyForm, setDailyForm] = useState({
    customer_name: '',
    project_number: '',
    contact_name: '',
    contact_phone: '',
    delivery_address: '',
    note: '',
  });
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();

  const [loading, setLoading] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (selectedType === 'project') {
        const { error } = await supabase.from('projects').insert({
          customer_name: form.customer_name,
          project_number: form.project_number || null,
          project_name: form.project_name || null,
          warehouse_address: form.warehouse_address || null,
          zoho_deal_id: form.zoho_deal_id || null,
          rollout_start: rolloutStart ? format(rolloutStart, 'yyyy-MM-dd') : null,
          rollout_end: rolloutEnd ? format(rolloutEnd, 'yyyy-MM-dd') : null,
          project_type: 'project',
        } as any);
        if (error) throw error;
      } else {
        const contacts = dailyForm.contact_name
          ? [{ name: dailyForm.contact_name, phone: dailyForm.contact_phone }]
          : [];
        const { error } = await supabase.from('projects').insert({
          customer_name: dailyForm.customer_name,
          project_number: dailyForm.project_number || null,
          customer_contacts: contacts,
          warehouse_address: dailyForm.delivery_address || null,
          rollout_start: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
          logistics_notes: dailyForm.note || null,
          project_type: 'daily',
          status: 'draft',
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(selectedType === 'project' ? 'Projekt erstellt' : 'Auftrag erstellt');
      onOpenChange(false);
      resetAll();
    },
    onError: (err: any) => {
      toast.error('Fehler: ' + err.message);
    },
  });

  const resetAll = () => {
    setSelectedType(null);
    setForm({ customer_name: '', project_number: '', project_name: '', warehouse_address: '', zoho_deal_id: '' });
    setRolloutStart(undefined);
    setRolloutEnd(undefined);
    setDailyForm({ customer_name: '', project_number: '', contact_name: '', contact_phone: '', delivery_address: '', note: '' });
    setDeliveryDate(undefined);
  };

  const loadFromZoho = async () => {
    if (!ZOHO?.CRM) { toast.error('Zoho CRM nicht verfügbar (Dev Mode)'); return; }
    const id = dealId;
    if (!id) { toast.error('Keine Deal-ID verfügbar'); return; }
    setLoading(true);
    try {
      const resp = await ZOHO.CRM.API.getRecord({ Entity: 'Deals', RecordID: id });
      const deal = resp.data?.[0];
      if (deal) {
        setForm(prev => ({
          ...prev,
          customer_name: deal.Account_Name?.name || deal.Deal_Name || '',
          project_name: deal.Deal_Name || '',
          zoho_deal_id: id,
        }));
        toast.success('Daten aus Zoho Deal geladen');
      }
    } catch (err: any) {
      toast.error('Zoho API Fehler: ' + err.message);
    } finally { setLoading(false); }
  };

  const canSubmit = selectedType === 'project' ? !!form.customer_name : !!dailyForm.customer_name;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className={cn('transition-all', selectedType ? 'sm:max-w-[540px]' : 'sm:max-w-[620px]')}>
        <DialogHeader>
          <DialogTitle className="font-heading">
            {!selectedType ? 'Neuer Vorgang' : selectedType === 'project' ? 'Neues MPS-Projekt' : 'Neuer Tagesgeschäft-Auftrag'}
          </DialogTitle>
        </DialogHeader>

        {/* Type selection */}
        {!selectedType && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <TypeCard
              icon={<Package className="h-10 w-10" />}
              title="📦 MPS-Projekt"
              subtitle="Vollständiger Rollout mit Analyse, Kalkulation, Konzept und Rollout-Planung."
              detail="Für: Flottenwechsel, Ausschreibungen, Neukundengewinnung"
              selected={false}
              onClick={() => setSelectedType('project')}
            />
            <TypeCard
              icon={<Printer className="h-10 w-10" />}
              title="🖨️ Tagesgeschäft"
              subtitle="Einzelgerät / Kleinauftrag: Schnelle Kalkulation, SOP erstellen, Auslieferung planen."
              detail="Für: Gerätetausch, Neuinstallation, Nachrüstung"
              selected={false}
              onClick={() => setSelectedType('daily')}
            />
          </div>
        )}

        {/* MPS Project Form */}
        {selectedType === 'project' && (
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={loadFromZoho} disabled={loading} className="font-heading text-xs">
                {loading ? 'Laden...' : 'Aus Zoho Deal laden'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-xs">← Zurück</Button>
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kundenname *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="z.B. Kramer GmbH" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-heading text-xs">Projektnummer</Label>
                <Input value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))} placeholder="z.B. P-2024-001" />
              </div>
              <div className="space-y-2">
                <Label className="font-heading text-xs">Projektbezeichnung</Label>
                <Input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-heading text-xs">Rollout-Start</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !rolloutStart && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rolloutStart ? format(rolloutStart, 'dd.MM.yyyy') : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={rolloutStart} onSelect={setRolloutStart} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="font-heading text-xs">Rollout-Ende</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !rolloutEnd && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rolloutEnd ? format(rolloutEnd, 'dd.MM.yyyy') : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={rolloutEnd} onSelect={setRolloutEnd} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Lager / Vorbereitungsort</Label>
              <Input value={form.warehouse_address} onChange={e => setForm(f => ({ ...f, warehouse_address: e.target.value }))} />
            </div>
          </div>
        )}

        {/* Daily Form */}
        {selectedType === 'daily' && (
          <div className="space-y-4 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-xs">← Zurück</Button>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kundenname *</Label>
              <Input value={dailyForm.customer_name} onChange={e => setDailyForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="z.B. Müller AG" />
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Auftragsnummer</Label>
              <Input value={dailyForm.project_number} onChange={e => setDailyForm(f => ({ ...f, project_number: e.target.value }))} placeholder="z.B. A-2026-042" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-heading text-xs">Ansprechpartner Name</Label>
                <Input value={dailyForm.contact_name} onChange={e => setDailyForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Max Mustermann" />
              </div>
              <div className="space-y-2">
                <Label className="font-heading text-xs">Telefon</Label>
                <Input value={dailyForm.contact_phone} onChange={e => setDailyForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+49 ..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Lieferadresse</Label>
              <Input value={dailyForm.delivery_address} onChange={e => setDailyForm(f => ({ ...f, delivery_address: e.target.value }))} placeholder="Straße, PLZ Ort" />
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Gewünschter Liefertermin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !deliveryDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryDate ? format(deliveryDate, 'dd.MM.yyyy') : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kurznotiz</Label>
              <Textarea
                value={dailyForm.note}
                onChange={e => setDailyForm(f => ({ ...f, note: e.target.value }))}
                placeholder="z.B. Gerätetausch MFP Buchhaltung"
                rows={2}
              />
            </div>
          </div>
        )}

        {selectedType && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetAll(); onOpenChange(false); }}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? 'Speichern...' : selectedType === 'project' ? 'Projekt erstellen' : 'Auftrag erstellen'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({ title, subtitle, detail, selected, onClick }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  detail: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start text-left p-5 rounded-xl border-2 transition-all hover:border-primary hover:shadow-md',
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card',
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <p className="font-heading font-bold text-base mb-1.5">{title}</p>
      <p className="text-sm text-muted-foreground leading-snug mb-3">{subtitle}</p>
      <p className="text-[11px] text-muted-foreground/70">{detail}</p>
    </button>
  );
}
