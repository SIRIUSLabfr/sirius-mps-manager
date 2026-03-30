import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, X } from 'lucide-react';
import { useZoho } from '@/hooks/useZoho';
import { cn } from '@/lib/utils';

export interface ZohoProduct {
  name: string;
  price: number;
  id: string;
  category: string;
}

export type FilterType = 'main_device' | 'accessory' | 'service_bw' | 'service_color';

const CATEGORY_MAP: Record<FilterType, string[]> = {
  main_device: ['Grundgerät A3', 'Grundgerät A4', 'Scanner', 'LFP'],
  accessory: ['Option A3', 'Option A4', 'Software Print'],
  service_bw: ['Seitenpreis S/W'],
  service_color: ['Seitenpreis Farbe'],
};

interface ZohoProductSearchProps {
  value: ZohoProduct | null;
  onChange: (product: ZohoProduct | null) => void;
  filterType: FilterType;
  placeholder?: string;
  className?: string;
  /** Legacy prop - mapped to filterType internally */
  categoryFilter?: string[];
}

export default function ZohoProductSearch({
  value,
  onChange,
  filterType,
  placeholder = 'Produkt suchen…',
  className,
  categoryFilter: legacyCategoryFilter,
}: ZohoProductSearchProps) {
  const { isZohoAvailable } = useZoho();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const categories = legacyCategoryFilter || CATEGORY_MAP[filterType] || [];
  const zohoAvail = isZohoAvailable();

  useEffect(() => {
    if (!zohoAvail) setManualMode(true);
  }, [zohoAvail]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!isZohoAvailable() || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { zohoAPI } = await import('@/lib/zohoAPI');
        const records: any[] = await zohoAPI.searchRecord('Products', q) || [];
        const filtered = records.filter((r: any) => {
          const cat = r.Product_Category || r.Produktkategorie || '';
          return categories.length === 0 || categories.some((c) => cat.includes(c));
        });
        setResults(filtered);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [isZohoAvailable, categories]
  );

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const selectProduct = (record: any) => {
    const product: ZohoProduct = {
      name: record.Product_Name || record.Name || '',
      price: parseFloat(record.Unit_Price || record.Preis || '0') || 0,
      id: record.id || '',
      category: record.Product_Category || record.Produktkategorie || '',
    };
    onChange(product);
    setQuery(product.name);
    setOpen(false);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    setResults([]);
  };

  const handleManualConfirm = () => {
    if (!manualName.trim()) return;
    const product: ZohoProduct = {
      name: manualName.trim(),
      price: parseFloat(manualPrice.replace(',', '.')) || 0,
      id: `manual-${crypto.randomUUID().slice(0, 8)}`,
      category: categories[0] || '',
    };
    onChange(product);
    setManualName('');
    setManualPrice('');
  };

  // Manual mode (no Zoho)
  if (manualMode && !value) {
    return (
      <div className={cn('flex gap-2', className)}>
        <Input
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Produktname"
          className="h-9 text-sm flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleManualConfirm()}
        />
        <Input
          type="number"
          value={manualPrice}
          onChange={(e) => setManualPrice(e.target.value)}
          placeholder="Preis €"
          className="h-9 text-sm w-24"
          step="0.01"
          onKeyDown={(e) => e.key === 'Enter' && handleManualConfirm()}
        />
      </div>
    );
  }

  if (manualMode && value) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-9 flex items-center text-sm font-medium truncate">
          {value.name}
        </div>
        <button
          type="button"
          onClick={clearSelection}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value ? value.name : query}
          onChange={(e) => {
            if (value) clearSelection();
            handleInputChange(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-8 h-9 text-sm"
        />
        {value && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {results.map((r: any) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectProduct(r)}
              className="w-full px-3 py-2 text-left hover:bg-accent/10 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  {r.Product_Name || r.Name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.Product_Category || r.Produktkategorie} · {r.Product_Code || r.Artikelnummer || '–'}
                </div>
              </div>
              <span className="text-sm font-medium text-primary whitespace-nowrap">
                {parseFloat(r.Unit_Price || r.Preis || '0').toLocaleString('de-DE', {
                  minimumFractionDigits: 2,
                })}{' '}
                €
              </span>
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-center text-sm text-muted-foreground">
          Keine Produkte gefunden
        </div>
      )}
    </div>
  );
}
