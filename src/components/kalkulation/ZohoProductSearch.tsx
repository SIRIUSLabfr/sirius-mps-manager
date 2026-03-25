import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { useZoho } from '@/hooks/useZoho';
import { cn } from '@/lib/utils';

export interface ZohoProduct {
  name: string;
  price: number;
  id: string;
  category: string;
}

interface ZohoProductSearchProps {
  value: ZohoProduct | null;
  onChange: (product: ZohoProduct | null) => void;
  categoryFilter: string[];
  placeholder?: string;
  className?: string;
}

export default function ZohoProductSearch({
  value,
  onChange,
  categoryFilter,
  placeholder = 'Produkt suchen…',
  className,
}: ZohoProductSearchProps) {
  const { ZOHO } = useZoho();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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
      if (!ZOHO?.CRM?.API || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const resp = await ZOHO.CRM.API.searchRecord({
          Entity: 'Products',
          Type: 'word',
          Query: q,
        });
        const records: any[] = resp?.data || [];
        // Filter by category
        const filtered = records.filter((r: any) => {
          const cat = r.Product_Category || r.Produktkategorie || '';
          return categoryFilter.length === 0 || categoryFilter.some((c) => cat.includes(c));
        });
        setResults(filtered);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [ZOHO, categoryFilter]
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
              className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between gap-2"
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
