import { useState, useRef, useEffect } from 'react';
import { zohoClient } from '@/lib/zohoClient';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, User } from 'lucide-react';

interface ZohoContact {
  id: string;
  Full_Name?: string;
  First_Name?: string;
  Last_Name?: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Title?: string;
  Department?: string;
}

interface SelectedContact {
  name: string;
  role: string;
  email: string;
  phone: string;
  zoho_contact_id?: string;
}

interface ZohoContactSearchProps {
  onSelect: (contact: SelectedContact) => void;
  placeholder?: string;
  className?: string;
}

export default function ZohoContactSearch({ onSelect, placeholder = 'Kontakt suchen (mind. 3 Zeichen)...', className }: ZohoContactSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ZohoContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  const search = (q: string) => {
    setQuery(q);
    if (q.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await zohoClient.api(`Contacts/search?word=${encodeURIComponent(q)}`);
        const contacts = res?.data || [];
        setResults(contacts.slice(0, 10));
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const handleSelect = (contact: ZohoContact) => {
    const name = contact.Full_Name || `${contact.First_Name || ''} ${contact.Last_Name || ''}`.trim();
    onSelect({
      name,
      role: contact.Title || contact.Department || '',
      email: contact.Email || '',
      phone: contact.Phone || contact.Mobile || '',
      zoho_contact_id: contact.id,
    });
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="pl-8 text-sm h-9"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map(c => {
            const name = c.Full_Name || `${c.First_Name || ''} ${c.Last_Name || ''}`.trim();
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-start gap-2 text-sm border-b border-border/50 last:border-0"
              >
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.Title && <span>{c.Title} · </span>}
                    {c.Email && <span>{c.Email}</span>}
                    {c.Phone && <span> · {c.Phone}</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showDropdown && query.length >= 3 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg p-3 text-center">
          <p className="text-sm text-muted-foreground">Keine Kontakte gefunden</p>
        </div>
      )}
    </div>
  );
}
