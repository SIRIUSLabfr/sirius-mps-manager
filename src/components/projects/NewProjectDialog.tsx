import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProject } from '@/hooks/useActiveProject';
import { toast } from 'sonner';
import { generateEmptySteps } from '@/lib/orderProcessingConfig';
import { format } from 'date-fns';
import { CalendarIcon, Package, Printer, Check, Loader2, LinkIcon } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'project' | 'daily' | null;
  zohoPreFill?: { customer_name?: string; contact_name?: string; deal_id?: string };
}

type ProjectType = 'project' | 'daily' | null;

export default function NewProjectDialog({ open, onOpenChange, defaultType = null, zohoPreFill }: NewProjectDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveProjectId } = useActiveProject();
  const { dealId } = useZoho();
  const [selectedType, setSelectedType] = useState<ProjectType>(defaultType);
  const [isLoadingDeal, setIsLoadingDeal] = useState(false);
  const [dealLoaded, setDealLoaded] = useState(false);
  const [dealLoadError, setDealLoadError] = useState(false);

  // Reset to defaultType when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedType(defaultType);
      setDealLoaded(false);
      setDealLoadError(false);
    }
  }, [open, defaultType]);

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

  // Resolve the effective deal ID from props or context
  const effectiveDealId = zohoPreFill?.deal_id || dealId;

  // Load deal data from Zoho when dialog opens with a deal_id
  useEffect(() => {
    if (!open || !effectiveDealId || dealLoaded) return;

    const loadDealData = async () => {
      setIsLoadingDeal(true);
      setDealLoadError(false);
      try {
        const response = await fetch('/.netlify/functions/zoho-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: `Deals/${effectiveDealId}`, method: 'GET' }),
        });

        if (response.ok) {
          const result = await response.json();
          const deal = result?.data?.[0];
          if (deal) {
            const customerName = deal.Account_Name?.name || (typeof deal.Account_Name === 'string' ? deal.Account_Name : '') || deal.Deal_Name || '';
            const contactName = deal.Contact_Name?.name || (typeof deal.Contact_Name === 'string' ? deal.Contact_Name : '') || '';
            const dealNumber = deal.Deal_Number ? String(deal.Deal_Number) : '';
            const description = deal.Description || '';
            const closingDate = deal.Closing_Date ? new Date(deal.Closing_Date) : undefined;

            // Try to get billing address from the associated Account
            let billingAddress = '';
            const accountId = deal.Account_Name?.id;
            if (accountId) {
              try {
                const accResponse = await fetch('/.netlify/functions/zoho-api', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ endpoint: `Accounts/${accountId}`, method: 'GET' }),
                });
                if (accResponse.ok) {
                  const accResult = await accResponse.json();
                  const acc = accResult?.data?.[0];
                  if (acc) {
                    billingAddress = [acc.Billing_Street, acc.Billing_Code, acc.Billing_City].filter(Boolean).join(', ');
                  }
                }
              } catch (e) {
                console.warn('Account-Daten konnten nicht geladen werden:', e);
              }
            }
            // Fallback to deal shipping address
            if (!billingAddress) {
              billingAddress = [deal.Shipping_Street, deal.Shipping_City].filter(Boolean).join(', ');
            }

            // Pre-fill MPS form
            setForm(f => ({
              ...f,
              customer_name: customerName || f.customer_name,
              project_number: dealNumber || f.project_number,
              project_name: deal.Deal_Name || f.project_name,
              zoho_deal_id: effectiveDealId,
            }));
            if (closingDate && !isNaN(closingDate.getTime())) {
              setRolloutEnd(closingDate);
            }

            // Pre-fill daily form
            setDailyForm(f => ({
              ...f,
              customer_name: customerName || f.customer_name,
              contact_name: contactName || f.contact_name,
              project_number: dealNumber || f.project_number,
              delivery_address: billingAddress || f.delivery_address,
              note: description || f.note,
            }));
            if (closingDate && !isNaN(closingDate.getTime())) {
              setDeliveryDate(closingDate);
            }

            setDealLoaded(true);
          }
        } else if (response.status === 401) {
          console.log('Zoho nicht verbunden, Felder bleiben leer');
          setDealLoadError(true);
        }
      } catch (e) {
        console.warn('Deal-Daten konnten nicht geladen werden:', e);
        setDealLoadError(true);
      } finally {
        setIsLoadingDeal(false);
      }
    };

    // Set zoho_deal_id immediately
    setForm(f => ({ ...f, zoho_deal_id: effectiveDealId }));
    loadDealData();
  }, [open, effectiveDealId, dealLoaded]);

  // Pre-fill from zoho props (fallback if API call fails)
  useEffect(() => {
    if (zohoPreFill && open) {
      if (zohoPreFill.customer_name) {
        setForm(f => ({ ...f, customer_name: f.customer_name || zohoPreFill.customer_name || '' }));
        setDailyForm(f => ({ ...f, customer_name: f.customer_name || zohoPreFill.customer_name || '' }));
      }
      if (zohoPreFill.contact_name) {
        setDailyForm(f => ({ ...f, contact_name: f.contact_name || zohoPreFill.contact_name || '' }));
      }
      if (zohoPreFill.deal_id) {
        setForm(f => ({ ...f, zoho_deal_id: zohoPreFill.deal_id || '' }));
      }
    }
  }, [zohoPreFill, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      let insertData: any;
      if (selectedType === 'project') {
        insertData = {
          customer_name: form.customer_name,
          project_number: form.project_number || null,
          project_name: form.project_name || null,
          warehouse_address: form.warehouse_address || null,
          zoho_deal_id: form.zoho_deal_id || null,
          rollout_start: rolloutStart ? format(rolloutStart, 'yyyy-MM-dd') : null,
          rollout_end: rolloutEnd ? format(rolloutEnd, 'yyyy-MM-dd') : null,
          project_type: 'project',
        };
      } else {
        const contacts = dailyForm.contact_name
          ? [{ name: dailyForm.contact_name, phone: dailyForm.contact_phone }]
          : [];
        insertData = {
          customer_name: dailyForm.customer_name,
          project_number: dailyForm.project_number || null,
          customer_contacts: contacts,
          warehouse_address: dailyForm.delivery_address || null,
          rollout_start: deliveryDate ? format(deliveryDate, 'yyyy-MM-dd') : null,
          logistics_notes: dailyForm.note || null,
          project_type: 'daily',
          zoho_deal_id: form.zoho_deal_id || null,
          status: 'draft',
        };
      }
      const { data, error } = await supabase.from('projects').insert(insertData as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Auto-create order_processing entry
      if (data?.id) {
        const pt = selectedType || 'project';
        await supabase.from('order_processing' as any).insert({
          project_id: data.id,
          steps: generateEmptySteps(pt),
          status: 'offen',
        } as any);
      }
      toast.success(selectedType === 'project' ? 'Angebot erstellt' : 'Angebot erstellt');
      onOpenChange(false);
      resetAll();
      if (data?.id) {
        setActiveProjectId(data.id);
        navigate(`/projekt/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast.error('Fehler: ' + err.message);
    },
  });

  const resetAll = () => {
    setSelectedType(defaultType);
    setForm({ customer_name: '', project_number: '', project_name: '', warehouse_address: '', zoho_deal_id: '' });
    setRolloutStart(undefined);
    setRolloutEnd(undefined);
    setDailyForm({ customer_name: '', project_number: '', contact_name: '', contact_phone: '', delivery_address: '', note: '' });
    setDeliveryDate(undefined);
  };

  // loadFromZoho entfernt – SDK nicht mehr verfügbar

  const canSubmit = selectedType === 'project' ? !!form.customer_name : !!dailyForm.customer_name;
  const showTypeSelection = !defaultType && !selectedType;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAll(); onOpenChange(v); }}>
      <DialogContent className={cn('transition-all', showTypeSelection ? 'sm:max-w-[620px]' : 'sm:max-w-[540px]')}>
        <DialogHeader>
          <DialogTitle className="font-heading">
            {showTypeSelection ? 'Neuer Vorgang' : selectedType === 'project' ? 'Neues MPS-Angebot' : 'Neues Tagesgeschäft-Angebot'}
          </DialogTitle>
        </DialogHeader>

        {/* Zoho Deal info */}
        {effectiveDealId && (
          <div className="space-y-1">
            <Badge variant="outline" className="text-xs gap-1 font-normal">
              <LinkIcon className="h-3 w-3" />
              Zoho Deal: {effectiveDealId}
            </Badge>
            {isLoadingDeal && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Lade Deal-Daten aus Zoho...
              </div>
            )}
            {dealLoadError && !isLoadingDeal && (
              <p className="text-xs text-muted-foreground">
                Deal-Daten konnten nicht geladen werden. Bitte manuell ausfüllen.
              </p>
            )}
          </div>
        )}

        {/* Type selection */}
        {showTypeSelection && (
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
              {!defaultType && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-xs">← Zurück</Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kundenname *</Label>
              <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="z.B. Kramer GmbH" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-heading text-xs">Angebotsnummer</Label>
                <Input value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))} placeholder="z.B. A-2024-001" />
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
            <div className="flex gap-2">
              {!defaultType && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)} className="text-xs">← Zurück</Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Kundenname *</Label>
              <Input value={dailyForm.customer_name} onChange={e => setDailyForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="z.B. Müller AG" />
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Angebotsnummer</Label>
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
              {createMutation.isPending ? 'Speichern...' : 'Angebot erstellen'}
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
