import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
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
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const categories = legacyCategoryFilter || CATEGORY_MAP[filterType] || [];

  const clearSelection = () => {
    onChange(null);
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

  if (value) {
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
