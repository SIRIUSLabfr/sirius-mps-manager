import { useMemo, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Tables } from '@/integrations/supabase/types';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ausstehend' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'prepared', label: 'Vorgerichtet' },
  { value: 'delivered', label: 'Ausgeliefert' },
];

interface Props {
  sop: Tables<'sop_orders'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: Tables<'users'>[];
  onUpdated: () => void;
}

export default function SopDetailSheet({ sop, open, onOpenChange, users, onUpdated }: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const save = useCallback(async (field: string, value: any) => {
    if (!sop) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from('sop_orders').update({ [field]: value }).eq('id', sop.id);
      if (error) toast.error('Speichern fehlgeschlagen');
      else onUpdated();
    }, 600);
  }, [sop, onUpdated]);

  if (!sop) return null;

  const Field = ({ label, field, value, type = 'text' }: { label: string; field: string; value: string | null; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">{label}</Label>
      {type === 'textarea' ? (
        <Textarea defaultValue={value || ''} onChange={e => save(field, e.target.value)} className="text-sm min-h-[60px]" />
      ) : (
        <Input defaultValue={value || ''} type={type} onChange={e => save(field, e.target.value)} className="text-sm h-8" />
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">
            {sop.manufacturer} {sop.model}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {sop.ow_number ? `Auftragsnr: ${sop.ow_number}` : 'Keine Auftragsnummer'} · Erstellt: {format(new Date(sop.created_at), 'dd.MM.yyyy')}
          </p>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Auftragsdaten */}
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-3">Auftragsdaten</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Auftragsnummer" field="ow_number" value={sop.ow_number} />
              <Field label="Ersteller" field="creator" value={sop.creator} />
              <Field label="Liefertermin" field="delivery_date" value={sop.delivery_date} type="date" />
              <Field label="Lieferzeit" field="delivery_time" value={sop.delivery_time as string | null} type="time" />
              <Field label="Endkontrolle Datum" field="end_check_date" value={sop.end_check_date} type="date" />
              <Field label="Endkontrolle Zeit" field="end_check_time" value={sop.end_check_time as string | null} type="time" />
            </div>
          </div>

          {/* Adresse & Kontakt */}
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-3">Adresse & Kontakt</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Kundenadresse" field="customer_address" value={sop.customer_address} /></div>
              <div className="col-span-2"><Field label="Lieferadresse" field="delivery_address" value={sop.delivery_address} /></div>
              <Field label="Ansprechpartner" field="contact_person" value={sop.contact_person} />
              <Field label="Etage" field="floor" value={sop.floor} />
              <Field label="Raum" field="room" value={sop.room} />
            </div>
          </div>

          {/* Gerätedaten */}
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-3">Gerätedaten</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hersteller" field="manufacturer" value={sop.manufacturer} />
              <Field label="Modell" field="model" value={sop.model} />
              <Field label="Seriennummer" field="serial_number" value={sop.serial_number} />
              <Field label="Geräte-ID" field="device_internal_id" value={sop.device_internal_id} />
              <div className="col-span-2"><Field label="Optionen" field="options" value={sop.options} /></div>
              <div className="col-span-2"><Field label="Verbrauchsmaterial" field="consumables" value={sop.consumables} /></div>
              <div className="col-span-2"><Field label="Lizenzen" field="licenses" value={sop.licenses} /></div>
              <div className="col-span-2"><Field label="Netzwerk-Voreinstellung" field="network_settings" value={sop.network_settings} type="textarea" /></div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-3">Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">Vorbereitung</Label>
                <Select defaultValue={sop.preparation_status} onValueChange={v => save('preparation_status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">Lieferung</Label>
                <Select defaultValue={sop.delivery_status} onValueChange={v => save('delivery_status', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground">Mitarbeiter</Label>
                <Select defaultValue={sop.technician || ''} onValueChange={v => save('technician', v || null)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nicht zugewiesen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">– Nicht zugewiesen –</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Bemerkungen */}
          <div>
            <h3 className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-3">Bemerkungen</h3>
            <Field label="" field="remarks" value={sop.remarks} type="textarea" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
