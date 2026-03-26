import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ZohoProductSearch, { type ZohoProduct, type FilterType } from './ZohoProductSearch';

export interface ServiceItem {
  id: string;
  type: 'bw' | 'color';
  product: ZohoProduct | null;
  quantity: number;
}

export interface ServiceConfig {
  items: ServiceItem[];
}

interface MischklickData {
  totalSwCost: number;
  totalSwVolume: number;
  mischklickSw: number;
  totalColorCost: number;
  totalColorVolume: number;
  mischklickColor: number;
  totalServiceRate: number;
}

interface Props {
  config: ServiceConfig;
  onChange: (config: ServiceConfig) => void;
  mischklick: MischklickData;
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function calcMixServiceRate(cfg: ServiceConfig): number {
  return cfg.items.reduce((s, it) => s + (it.product?.price || 0) * it.quantity, 0);
}

export function calcMixServiceVolumes(cfg: ServiceConfig) {
  let bw = 0;
  let color = 0;
  for (const it of cfg.items) {
    if (!it.product) continue;
    if (it.type === 'bw') bw += it.quantity;
    else color += it.quantity;
  }
  return { bw, color };
}

export function calcMixServiceCosts(cfg: ServiceConfig) {
  let bwCost = 0;
  let colorCost = 0;
  for (const it of cfg.items) {
    if (!it.product) continue;
    const cost = it.product.price * it.quantity;
    if (it.type === 'bw') bwCost += cost;
    else colorCost += cost;
  }
  return { bwCost, colorCost };
}

export default function ServiceCard({ config, onChange, mischklick }: Props) {
  const addItem = () => {
    onChange({
      ...config,
      items: [
        ...config.items,
        { id: crypto.randomUUID(), type: 'bw', product: null, quantity: 1000 },
      ],
    });
  };

  const updateItem = (idx: number, patch: Partial<ServiceItem>) => {
    const items = [...config.items];
    items[idx] = { ...items[idx], ...patch };
    // If type changed, clear product
    if (patch.type && patch.type !== config.items[idx].type) {
      items[idx].product = null;
    }
    onChange({ ...config, items });
  };

  const removeItem = (idx: number) => {
    onChange({ ...config, items: config.items.filter((_, i) => i !== idx) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base">Mischkalkulation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Zusätzliche Klick-Modelle, die nicht an ein einzelnes Gerät gebunden sind (z.B. pauschale Seitenpreise).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {config.items.map((it, i) => (
          <div key={it.id} className="grid grid-cols-[90px_1fr_100px_100px_28px] gap-2 items-end">
            <Select
              value={it.type}
              onValueChange={(v) => updateItem(i, { type: v as 'bw' | 'color' })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bw">S/W</SelectItem>
                <SelectItem value="color">Farbe</SelectItem>
              </SelectContent>
            </Select>
            <ZohoProductSearch
              value={it.product}
              onChange={(p) => updateItem(i, { product: p })}
              filterType={it.type === 'bw' ? 'service_bw' : 'service_color'}
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
              title="Volumen"
              placeholder="Volumen"
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

        {/* Mischklick-Info Box */}
        <div className="mt-4 p-4 bg-secondary/5 border border-secondary/20 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-secondary" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-secondary">
              Mischklick-Übersicht
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">S/W Mischklick:</span>
              <span className="font-semibold text-secondary">
                {mischklick.totalSwVolume > 0 ? `${fmt4(mischklick.mischklickSw)} €` : '–'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Farb Mischklick:</span>
              <span className="font-semibold text-secondary">
                {mischklick.totalColorVolume > 0 ? `${fmt4(mischklick.mischklickColor)} €` : '–'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">S/W Gesamtvolumen:</span>
              <span className="font-medium">{mischklick.totalSwVolume.toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Farb Gesamtvolumen:</span>
              <span className="font-medium">{mischklick.totalColorVolume.toLocaleString('de-DE')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">S/W Gesamtkosten:</span>
              <span className="font-medium">{fmt(mischklick.totalSwCost)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Farb Gesamtkosten:</span>
              <span className="font-medium">{fmt(mischklick.totalColorCost)} €</span>
            </div>
          </div>
          <div className="pt-2 border-t border-secondary/20 flex justify-between text-sm">
            <span className="font-heading font-semibold">Service-Rate gesamt (alle Klicks):</span>
            <span className="font-heading font-bold text-secondary">{fmt(mischklick.totalServiceRate)} €</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
