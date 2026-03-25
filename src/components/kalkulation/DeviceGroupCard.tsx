import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import ZohoProductSearch, { type ZohoProduct } from './ZohoProductSearch';

export interface DeviceGroup {
  id: string;
  device: ZohoProduct | null;
  accessories: ZohoProduct[];
  quantity: number;
  ekOverride: number | null;
}

interface DeviceGroupCardProps {
  group: DeviceGroup;
  index: number;
  onChange: (group: DeviceGroup) => void;
  onRemove: () => void;
}

export default function DeviceGroupCard({ group, index, onChange, onRemove }: DeviceGroupCardProps) {
  const devicePrice = group.ekOverride ?? (group.device?.price || 0);
  const accessoriesTotal = group.accessories.reduce((s, a) => s + (a?.price || 0), 0);
  const unitTotal = devicePrice + accessoriesTotal;
  const groupTotal = unitTotal * group.quantity;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base">Gerätegruppe {index + 1}</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary">
              {groupTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-heading">Hauptgerät</Label>
            <ZohoProductSearch
              value={group.device}
              onChange={(p) => onChange({ ...group, device: p })}
              categoryFilter={['Grundgerät A3', 'Grundgerät A4', 'Scanner', 'LFP']}
              placeholder="Gerät suchen…"
            />
            {group.device && (
              <div className="text-xs text-muted-foreground mt-1">
                Listenpreis: {group.device.price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-heading">Anzahl</Label>
              <Input
                type="number"
                min={1}
                value={group.quantity}
                onChange={(e) => onChange({ ...group, quantity: parseInt(e.target.value) || 1 })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-heading">EK Überschr. €</Label>
              <Input
                type="number"
                step="any"
                value={group.ekOverride ?? ''}
                onChange={(e) =>
                  onChange({
                    ...group,
                    ekOverride: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="auto"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Accessories */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-heading">Zubehör / Optionen</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() =>
                onChange({ ...group, accessories: [...group.accessories, null as any] })
              }
            >
              <Plus className="h-3 w-3" /> Zubehör
            </Button>
          </div>
          {group.accessories.map((acc, ai) => (
            <div key={ai} className="flex items-center gap-2">
              <ZohoProductSearch
                value={acc}
                onChange={(p) => {
                  const newAcc = [...group.accessories];
                  if (p) {
                    newAcc[ai] = p;
                  } else {
                    newAcc.splice(ai, 1);
                  }
                  onChange({ ...group, accessories: newAcc });
                }}
                categoryFilter={['Option A3', 'Option A4', 'Software Print']}
                placeholder="Zubehör suchen…"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive shrink-0"
                onClick={() => {
                  const newAcc = [...group.accessories];
                  newAcc.splice(ai, 1);
                  onChange({ ...group, accessories: newAcc });
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Unit summary */}
        <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2">
          <span className="text-muted-foreground">
            Stückpreis: {unitTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € × {group.quantity}
          </span>
          <span className="font-semibold">
            = {groupTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
