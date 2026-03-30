import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useZoho } from '@/hooks/useZoho';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2, Package } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  locations: Tables<'locations'>[];
  onCreated: () => void;
  nextDeviceNumber: number;
}

interface ZohoProduct {
  id: string;
  Product_Name: string;
  Product_Category?: string;
  Unit_Price?: number;
  Manufacturer?: string;
}

export default function NewSollDeviceDialog({ open, onOpenChange, projectId, locations, onCreated, nextDeviceNumber }: Props) {
  const { isZohoAvailable } = useZoho();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    soll_manufacturer: '',
    soll_model: '',
    soll_serial: '',
    soll_device_id: '',
    soll_options: '',
    soll_floor: '',
    soll_room: '',
    location_id: '',
  });

  // Zoho product search
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [products, setProducts] = useState<ZohoProduct[]>([]);
  const [showProducts, setShowProducts] = useState(false);

  const handleSearchZoho = async () => {
    if (!isZohoAvailable() || !searchTerm.trim()) return;
    setSearching(true);
    setShowProducts(true);
    try {
      const { zohoAPI } = await import('@/lib/zohoAPI');
      const data = await zohoAPI.searchRecord('Products', searchTerm);
      setProducts(data || []);
    } catch {
      setProducts([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (p: ZohoProduct) => {
    setForm(prev => ({
      ...prev,
      soll_manufacturer: p.Manufacturer || prev.soll_manufacturer,
      soll_model: p.Product_Name || prev.soll_model,
    }));
    setShowProducts(false);
    setSearchTerm('');
  };

  const handleSave = async () => {
    if (!form.soll_manufacturer && !form.soll_model) {
      toast.error('Bitte mindestens Hersteller oder Modell angeben');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('devices').insert({
        project_id: projectId,
        device_number: nextDeviceNumber,
        preparation_status: 'pending',
        soll_manufacturer: form.soll_manufacturer || null,
        soll_model: form.soll_model || null,
        soll_serial: form.soll_serial || null,
        soll_device_id: form.soll_device_id || null,
        soll_options: form.soll_options || null,
        soll_floor: form.soll_floor || null,
        soll_room: form.soll_room || null,
        location_id: form.location_id || null,
      });
      if (error) throw error;
      toast.success('SOLL-Gerät angelegt');
      onCreated();
      onOpenChange(false);
      setForm({ soll_manufacturer: '', soll_model: '', soll_serial: '', soll_device_id: '', soll_options: '', soll_floor: '', soll_room: '', location_id: '' });
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">SOLL-Gerät hinzufügen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zoho Product Search */}
          {ZOHO && (
            <div className="space-y-2">
              <Label className="text-xs font-heading">Aus Zoho Products suchen</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Produktname suchen..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchZoho()}
                  className="text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleSearchZoho} disabled={searching}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {showProducts && (
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto bg-card">
                  {products.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">Keine Ergebnisse</p>
                  ) : products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 border-b border-border/50 last:border-0"
                    >
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.Product_Name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[p.Manufacturer, p.Product_Category, p.Unit_Price ? `${p.Unit_Price.toLocaleString('de-DE')} €` : null].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Hersteller</Label>
              <Input value={form.soll_manufacturer} onChange={e => set('soll_manufacturer', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modell</Label>
              <Input value={form.soll_model} onChange={e => set('soll_model', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seriennummer</Label>
              <Input value={form.soll_serial} onChange={e => set('soll_serial', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">SIRIUS-ID</Label>
              <Input value={form.soll_device_id} onChange={e => set('soll_device_id', e.target.value)} className="text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Optionen / Ausstattung</Label>
              <Input value={form.soll_options} onChange={e => set('soll_options', e.target.value)} className="text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Standort</Label>
              <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Standort wählen..." /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-sm">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Etage</Label>
              <Input value={form.soll_floor} onChange={e => set('soll_floor', e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Raum</Label>
              <Input value={form.soll_room} onChange={e => set('soll_room', e.target.value)} className="text-sm" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern...' : 'SOLL-Gerät anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
