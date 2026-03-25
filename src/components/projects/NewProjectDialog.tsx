import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useZoho } from '@/hooks/useZoho';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const queryClient = useQueryClient();
  const { ZOHO, dealId } = useZoho();
  const [form, setForm] = useState({
    customer_name: '',
    project_number: '',
    project_name: '',
    warehouse_address: '',
    zoho_deal_id: '',
  });
  const [rolloutStart, setRolloutStart] = useState<Date | undefined>();
  const [rolloutEnd, setRolloutEnd] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('projects').insert({
        customer_name: form.customer_name,
        project_number: form.project_number || null,
        project_name: form.project_name || null,
        warehouse_address: form.warehouse_address || null,
        zoho_deal_id: form.zoho_deal_id || null,
        rollout_start: rolloutStart ? format(rolloutStart, 'yyyy-MM-dd') : null,
        rollout_end: rolloutEnd ? format(rolloutEnd, 'yyyy-MM-dd') : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projekt erfolgreich erstellt');
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Fehler: ' + err.message);
    },
  });

  const resetForm = () => {
    setForm({ customer_name: '', project_number: '', project_name: '', warehouse_address: '', zoho_deal_id: '' });
    setRolloutStart(undefined);
    setRolloutEnd(undefined);
  };

  const loadFromZoho = async () => {
    if (!ZOHO?.CRM) {
      toast.error('Zoho CRM nicht verfügbar (Dev Mode)');
      return;
    }
    const id = dealId;
    if (!id) {
      toast.error('Keine Deal-ID verfügbar');
      return;
    }
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
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Neues Projekt anlegen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadFromZoho} disabled={loading} className="font-heading text-xs">
              {loading ? 'Laden...' : 'Aus Zoho Deal laden'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="font-heading text-xs">Kundenname *</Label>
            <Input value={form.customer_name} onChange={e => handleChange('customer_name', e.target.value)} placeholder="z.B. Kramer GmbH" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-heading text-xs">Projektnummer</Label>
              <Input value={form.project_number} onChange={e => handleChange('project_number', e.target.value)} placeholder="z.B. P-2024-001" />
            </div>
            <div className="space-y-2">
              <Label className="font-heading text-xs">Projektbezeichnung</Label>
              <Input value={form.project_name} onChange={e => handleChange('project_name', e.target.value)} />
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
            <Input value={form.warehouse_address} onChange={e => handleChange('warehouse_address', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!form.customer_name || createMutation.isPending}>
            {createMutation.isPending ? 'Speichern...' : 'Projekt erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
