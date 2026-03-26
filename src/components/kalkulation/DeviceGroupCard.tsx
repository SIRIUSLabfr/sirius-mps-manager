import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import ZohoProductSearch, { type ZohoProduct } from './ZohoProductSearch';

export interface AccessoryItem {
  id: string;
  product: ZohoProduct | null;
  quantity: number;
}

export interface DeviceGroup {
  id: string;
  label: string;
  mainDevice: ZohoProduct | null;
  mainQuantity: number;
  accessories: AccessoryItem[];
}

interface Props {
  group: DeviceGroup;
  onChange: (group: DeviceGroup) => void;
  onRemove: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function calcGroupEk(g: DeviceGroup): number {
  const mainPrice = (g.mainDevice?.price || 0) * g.mainQuantity;
  const accPrice = g.accessories.reduce(
    (s, a) => s + (a.product?.price || 0) * a.quantity,
    0
  );
  return mainPrice + accPrice;
}

export default function DeviceGroupCard({ group, onChange, onRemove }: Props) {
  const groupTotal = calcGroupEk(group);

  const addAccessory = () => {
    onChange({
      ...group,
      accessories: [
        ...group.accessories,
        { id: crypto.randomUUID(), product: null, quantity: 1 },
      ],
    });
  };

  const updateAcc = (idx: number, patch: Partial<AccessoryItem>) => {
    const acc = [...group.accessories];
    acc[idx] = { ...acc[idx], ...patch };
    onChange({ ...group, accessories: acc });
  };

  const removeAcc = (idx: number) => {
    onChange({
      ...group,
      accessories: group.accessories.filter((_, i) => i !== idx),
    });
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 space-y-4">
        {/* Header: label + delete */}
        <div className="flex items-center gap-2">
          <Input
            value={group.label}
            onChange={(e) => onChange({ ...group, label: e.target.value })}
            placeholder="Standort / Bezeichnung"
            className="h-9 text-sm font-semibold border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* HAUPTGERÄT */}
        <div className="space-y-2">
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-secondary">
            Hauptgerät
          </span>
          <div className="grid grid-cols-[1fr_80px_100px] gap-2 items-end">
            <ZohoProductSearch
              value={group.mainDevice}
              onChange={(p) => onChange({ ...group, mainDevice: p })}
              categoryFilter={['Grundgerät A3', 'Grundgerät A4', 'Scanner', 'LFP']}
              placeholder="Gerät suchen..."
            />
            <Input
              type="number"
              min={1}
              value={group.mainQuantity}
              onChange={(e) =>
                onChange({ ...group, mainQuantity: parseInt(e.target.value) || 1 })
              }
              className="h-9 text-sm text-center"
              title="Menge"
            />
            <div className="h-9 flex items-center justify-end text-sm font-medium text-foreground pr-1">
              {group.mainDevice ? `${fmt(group.mainDevice.price * group.mainQuantity)} €` : '–'}
            </div>
          </div>
        </div>

        {/* ZUBEHÖR */}
        <div className="space-y-2">
          <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
            Zubehör
          </span>
          {group.accessories.map((acc, i) => (
            <div key={acc.id} className="grid grid-cols-[1fr_80px_100px_28px] gap-2 items-end">
              <ZohoProductSearch
                value={acc.product}
                onChange={(p) => updateAcc(i, { product: p })}
                categoryFilter={['Option A3', 'Option A4', 'Software Print']}
                placeholder="Option suchen..."
              />
              <Input
                type="number"
                min={1}
                value={acc.quantity}
                onChange={(e) =>
                  updateAcc(i, { quantity: parseInt(e.target.value) || 1 })
                }
                className="h-9 text-sm text-center"
              />
              <div className="h-9 flex items-center justify-end text-sm text-foreground pr-1">
                {acc.product ? `${fmt(acc.product.price * acc.quantity)} €` : '–'}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeAcc(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed border-secondary text-secondary hover:bg-secondary/5 text-xs gap-1"
            onClick={addAccessory}
          >
            <Plus className="h-3 w-3" /> Zubehör
          </Button>
        </div>

        {/* Group total */}
        <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2">
          <span className="text-muted-foreground">Gruppen-EK</span>
          <span className="font-semibold font-heading">{fmt(groupTotal)} €</span>
        </div>
      </CardContent>
    </Card>
  );
}
