import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LocationNode, LocationType } from '@/hooks/useLocationData';

interface LocationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    short_name?: string;
    address_street?: string;
    address_zip?: string;
    address_city?: string;
    notes?: string;
    parent_id?: string | null;
    location_type: LocationType;
  }) => void;
  editing?: LocationNode | null;
  parentId?: string | null;
  locationType: LocationType;
}

const typeLabels: Record<LocationType, string> = {
  site: 'Standort',
  building: 'Gebäude',
  floor: 'Stockwerk',
};

export default function LocationDialog({ open, onClose, onSave, editing, parentId, locationType }: LocationDialogProps) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name || '');
      setShortName(editing.short_name || '');
      setStreet(editing.address_street || '');
      setZip(editing.address_zip || '');
      setCity(editing.address_city || '');
      setNotes(editing.notes || '');
    } else {
      setName(''); setShortName(''); setStreet(''); setZip(''); setCity(''); setNotes('');
    }
  }, [editing, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      short_name: shortName.trim() || undefined,
      address_street: street.trim() || undefined,
      address_zip: zip.trim() || undefined,
      address_city: city.trim() || undefined,
      notes: notes.trim() || undefined,
      parent_id: editing ? editing.parent_id : parentId,
      location_type: editing ? editing.location_type as LocationType : locationType,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {editing ? `${typeLabels[editing.location_type as LocationType]} bearbeiten` : `${typeLabels[locationType]} hinzufügen`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={locationType === 'floor' ? 'z.B. 1. OG' : 'Name'} />
          </div>
          <div>
            <Label>Kurzname</Label>
            <Input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="Kürzel" />
          </div>
          {locationType === 'site' && (
            <>
              <div>
                <Label>Straße</Label>
                <Input value={street} onChange={e => setStreet(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>PLZ</Label>
                  <Input value={zip} onChange={e => setZip(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Ort</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <div>
            <Label>Notizen</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
