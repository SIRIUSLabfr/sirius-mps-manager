import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import ZohoProductSearch, { type ZohoProduct } from './ZohoProductSearch';

export interface PagePrices {
  bw: { name: string; price: number; volume: number; id: string } | null;
  color: { name: string; price: number; volume: number; id: string } | null;
}

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
  page_prices: PagePrices;
}

interface Props {
  group: DeviceGroup;
  onChange: (group: DeviceGroup) => void;
  onRemove: () => void;
  locations?: { id: string; name: string }[];
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function calcGroupEk(g: DeviceGroup): number {
  const mainPrice = (g.mainDevice?.price || 0) * g.mainQuantity;
  const accPrice = g.accessories.reduce(
    (s, a) => s + (a.product?.price || 0) * a.quantity,
    0
  );
  return mainPrice + accPrice;
}

export function calcGroupPageCosts(g: DeviceGroup): number {
  const bwCost = (g.page_prices?.bw?.price || 0) * (g.page_prices?.bw?.volume || 0);
  const colorCost = (g.page_prices?.color?.price || 0) * (g.page_prices?.color?.volume || 0);
  return bwCost + colorCost;
}

export default function DeviceGroupCard({ group, onChange, onRemove, locations }: Props) {
  const groupTotal = calcGroupEk(group);
  const pageCosts = calcGroupPageCosts(group);
  const [pagePricesOpen, setPagePricesOpen] = useState(false);

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

  const updatePagePrice = (
    type: 'bw' | 'color',
    patch: Partial<{ name: string; price: number; volume: number; id: string }> | null
  ) => {
    const current = group.page_prices || { bw: null, color: null };
    if (patch === null) {
      onChange({ ...group, page_prices: { ...current, [type]: null } });
    } else {
      const existing = current[type] || { name: '', price: 0, volume: 0, id: '' };
      onChange({
        ...group,
        page_prices: { ...current, [type]: { ...existing, ...patch } },
      });
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 space-y-4">
        {/* Header: label + location dropdown + delete */}
        <div className="flex items-center gap-2">
          {locations && locations.length > 0 ? (
            <Select
              value={group.label || '__custom__'}
              onValueChange={(v) => {
                if (v === '__custom__') {
                  onChange({ ...group, label: '' });
                } else {
                  onChange({ ...group, label: v });
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm font-semibold flex-1">
                <SelectValue placeholder="Standort wählen oder eingeben" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">Manuell eingeben…</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={group.label}
              onChange={(e) => onChange({ ...group, label: e.target.value })}
              placeholder="Standort / Bezeichnung"
              className="h-9 text-sm font-semibold border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            />
          )}
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
              filterType="main_device"
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

        {/* SEITENPREISE (collapsible) */}
        <Collapsible open={pagePricesOpen} onOpenChange={setPagePricesOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-heading font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1"
            >
              {pagePricesOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Seitenpreise
              {pageCosts > 0 && (
                <span className="ml-auto text-secondary font-semibold">
                  {fmt(pageCosts)} € / Mon.
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted/20 rounded-lg border border-border/40 space-y-3">
              {/* S/W Seitenpreis */}
              <div className="space-y-1">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  S/W-Seitenpreis
                </span>
                <div className="grid grid-cols-[1fr_100px_80px] gap-2 items-end">
                  <ZohoProductSearch
                    value={
                      group.page_prices?.bw
                        ? { name: group.page_prices.bw.name, price: group.page_prices.bw.price, id: group.page_prices.bw.id, category: 'Seitenpreis S/W' }
                        : null
                    }
                    onChange={(p) => {
                      if (p) {
                        updatePagePrice('bw', { name: p.name, price: p.price, id: p.id });
                      } else {
                        updatePagePrice('bw', null);
                      }
                    }}
                    filterType="service_bw"
                    placeholder="S/W Klick suchen..."
                  />
                  <Input
                    type="number"
                    min={0}
                    value={group.page_prices?.bw?.volume || ''}
                    onChange={(e) =>
                      updatePagePrice('bw', { volume: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm text-center"
                    placeholder="Volumen"
                  />
                  <div className="h-9 flex items-center justify-end text-xs text-muted-foreground pr-1">
                    {group.page_prices?.bw?.price ? `${fmt4(group.page_prices.bw.price)} €` : '–'}
                  </div>
                </div>
              </div>

              {/* Farb-Seitenpreis */}
              <div className="space-y-1">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  Farb-Seitenpreis
                </span>
                <div className="grid grid-cols-[1fr_100px_80px] gap-2 items-end">
                  <ZohoProductSearch
                    value={
                      group.page_prices?.color
                        ? { name: group.page_prices.color.name, price: group.page_prices.color.price, id: group.page_prices.color.id, category: 'Seitenpreis Farbe' }
                        : null
                    }
                    onChange={(p) => {
                      if (p) {
                        updatePagePrice('color', { name: p.name, price: p.price, id: p.id });
                      } else {
                        updatePagePrice('color', null);
                      }
                    }}
                    filterType="service_color"
                    placeholder="Farb-Klick suchen..."
                  />
                  <Input
                    type="number"
                    min={0}
                    value={group.page_prices?.color?.volume || ''}
                    onChange={(e) =>
                      updatePagePrice('color', { volume: parseInt(e.target.value) || 0 })
                    }
                    className="h-9 text-sm text-center"
                    placeholder="Volumen"
                  />
                  <div className="h-9 flex items-center justify-end text-xs text-muted-foreground pr-1">
                    {group.page_prices?.color?.price ? `${fmt4(group.page_prices.color.price)} €` : '–'}
                  </div>
                </div>
              </div>

              {/* Klick-Kosten/Monat */}
              {pageCosts > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Klick-Kosten / Monat</span>
                  <span className="font-semibold font-heading text-secondary">{fmt(pageCosts)} €</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

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
                filterType="accessory"
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
          <span className="text-muted-foreground">EK Gruppe</span>
          <span className="font-semibold font-heading">{fmt(groupTotal)} €</span>
        </div>
      </CardContent>
    </Card>
  );
}
