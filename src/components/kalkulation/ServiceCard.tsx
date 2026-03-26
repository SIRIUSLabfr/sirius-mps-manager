import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import ZohoProductSearch, { type ZohoProduct } from './ZohoProductSearch';

export interface ServiceItem {
  id: string;
  product: ZohoProduct | null;
  quantity: number;
}

export interface ServiceConfig {
  items: ServiceItem[];
}

interface Props {
  config: ServiceConfig;
  onChange: (config: ServiceConfig) => void;
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function calcServiceRate(cfg: ServiceConfig): number {
  return cfg.items.reduce((s, it) => s + (it.product?.price || 0) * it.quantity, 0);
}

export function calcServiceVolumes(cfg: ServiceConfig) {
  let bw = 0;
  let color = 0;
  for (const it of cfg.items) {
    if (!it.product) continue;
    const cat = it.product.category || '';
    if (cat.includes('S/W')) bw += it.quantity;
    else if (cat.includes('Farbe')) color += it.quantity;
  }
  return { bw, color };
}

export default function ServiceCard({ config, onChange }: Props) {
  const serviceTotal = calcServiceRate(config);

  const addItem = () => {
    onChange({
      ...config,
      items: [
        ...config.items,
        { id: crypto.randomUUID(), product: null, quantity: 1000 },
      ],
    });
  };

  const updateItem = (idx: number, patch: Partial<ServiceItem>) => {
    const items = [...config.items];
    items[idx] = { ...items[idx], ...patch };
    onChange({ ...config, items });
  };

  const removeItem = (idx: number) => {
    onChange({ ...config, items: config.items.filter((_, i) => i !== idx) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base">Service & Seitenpreise</CardTitle>
          <span className="text-sm font-semibold text-secondary">
            {fmt(serviceTotal)} € / Mon.
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {config.items.map((it, i) => (
          <div key={it.id} className="grid grid-cols-[1fr_100px_100px_28px] gap-2 items-end">
            <ZohoProductSearch
              value={it.product}
              onChange={(p) => updateItem(i, { product: p })}
              categoryFilter={['Seitenpreis Farbe', 'Seitenpreis S/W']}
              placeholder="Klick-Modell suchen..."
            />
            <Input
              type="number"
              min={0}
              value={it.quantity}
              onChange={(e) =>
                updateItem(i, { quantity: parseInt(e.target.value) || 0 })
              }
              className="h-9 text-sm text-center"
              title="Menge"
            />
            <div className="h-9 flex items-center justify-end text-sm font-medium text-foreground pr-1">
              {it.product ? `${fmt(it.product.price * it.quantity)} €` : '–'}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => removeItem(i)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed text-xs gap-1"
          onClick={addItem}
        >
          <Plus className="h-3 w-3" /> Klick-Modell hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
}
