import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { X, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useZoho } from '@/hooks/useZoho';
import { zohoClient } from '@/lib/zohoClient';

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
  categoryFilter?: string[];
}

export default function ZohoProductSearch({
  value,
  onChange,
  filterType,
  placeholder = 'Produktname eingeben…',
  className,
  categoryFilter: legacyCategoryFilter,
}: ZohoProductSearchProps) {
  const { isZohoConnected } = useZoho();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ZohoProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const categories = legacyCategoryFilter || CATEGORY_MAP[filterType] || [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchZoho = useCallback(async (term: string) => {
    if (term.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await zohoClient.searchProducts(term);
      const products: ZohoProduct[] = (res?.data || [])
        .filter((p: any) => {
          if (categories.length === 0) return true;
          return categories.some((cat) => (p.Product_Category || '').includes(cat));
        })
        .map((p: any) => ({
          name: p.Product_Name || p.name || '',
          price: p.Unit_Price || 0,
          id: p.id || '',
          category: p.Product_Category || '',
        }));
      setResults(products);
      setShowDropdown(products.length > 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [categories]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchZoho(val), 350);
  };

  const selectProduct = (p: ZohoProduct) => {
    onChange(p);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const clearSelection = () => onChange(null);

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

  // Selected state
  if (value) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex-1 h-9 flex items-center text-sm font-medium truncate">
          {value.name}
        </div>
        <button type="button" onClick={clearSelection} className="text-muted-foreground hover:text-destructive">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Zoho connected → live search
  if (isZohoConnected) {
    return (
      <div ref={wrapperRef} className={cn('relative', className)}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 text-sm pl-8 pr-8"
            onFocus={() => results.length > 0 && setShowDropdown(true)}
          />
          {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {showDropdown && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                onClick={() => selectProduct(p)}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {p.price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Not connected → manual input
  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        value={manualName}
        onChange={(e) => setManualName(e.target.value)}
        placeholder={placeholder}
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
