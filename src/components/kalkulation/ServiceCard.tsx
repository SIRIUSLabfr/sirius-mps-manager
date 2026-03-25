import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ZohoProductSearch, { type ZohoProduct } from './ZohoProductSearch';

export interface ServiceConfig {
  colorProduct: ZohoProduct | null;
  bwProduct: ZohoProduct | null;
  colorVolume: number;
  bwVolume: number;
  colorPriceOverride: number | null;
  bwPriceOverride: number | null;
}

interface ServiceCardProps {
  config: ServiceConfig;
  onChange: (config: ServiceConfig) => void;
}

export default function ServiceCard({ config, onChange }: ServiceCardProps) {
  const colorPrice = config.colorPriceOverride ?? (config.colorProduct?.price || 0);
  const bwPrice = config.bwPriceOverride ?? (config.bwProduct?.price || 0);
  const colorTotal = colorPrice * config.colorVolume;
  const bwTotal = bwPrice * config.bwVolume;
  const serviceTotal = colorTotal + bwTotal;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base">Service / Seitenpreise</CardTitle>
          <span className="text-sm font-semibold text-primary">
            {serviceTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € / Mon.
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Color */}
        <div className="space-y-2">
          <Label className="text-xs font-heading">Seitenpreis Farbe</Label>
          <ZohoProductSearch
            value={config.colorProduct}
            onChange={(p) => onChange({ ...config, colorProduct: p })}
            categoryFilter={['Seitenpreis Farbe']}
            placeholder="Farbe Seitenpreis suchen…"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Volumen / Mon.</Label>
              <Input
                type="number"
                value={config.colorVolume}
                onChange={(e) => onChange({ ...config, colorVolume: parseInt(e.target.value) || 0 })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preis / Seite €</Label>
              <Input
                type="number"
                step="0.0001"
                value={config.colorPriceOverride ?? config.colorProduct?.price ?? ''}
                onChange={(e) =>
                  onChange({
                    ...config,
                    colorPriceOverride: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="auto"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* BW */}
        <div className="space-y-2">
          <Label className="text-xs font-heading">Seitenpreis S/W</Label>
          <ZohoProductSearch
            value={config.bwProduct}
            onChange={(p) => onChange({ ...config, bwProduct: p })}
            categoryFilter={['Seitenpreis S/W']}
            placeholder="S/W Seitenpreis suchen…"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Volumen / Mon.</Label>
              <Input
                type="number"
                value={config.bwVolume}
                onChange={(e) => onChange({ ...config, bwVolume: parseInt(e.target.value) || 0 })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preis / Seite €</Label>
              <Input
                type="number"
                step="0.0001"
                value={config.bwPriceOverride ?? config.bwProduct?.price ?? ''}
                onChange={(e) =>
                  onChange({
                    ...config,
                    bwPriceOverride: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="auto"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2">
          <span className="text-muted-foreground">
            Farbe: {colorTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € + S/W: {bwTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
          </span>
          <span className="font-semibold">
            = {serviceTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € / Mon.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
