import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { zohoClient } from '@/lib/zohoClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, UserPlus, X, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ContactEntry {
  zoho_contact_id?: string;
  name: string;
  email?: string;
  phone?: string;
}

interface Props {
  projectId: string;
  /** Zoho Account-ID des verknüpften Deals — nur dann ist die Suche scoped. */
  accountId?: string | null;
  contacts: ContactEntry[];
  onChange: () => void;
}

/**
 * Pflegt die Liste der Kunden-Ansprechpartner am Projekt.
 * Suche nach >= 3 Zeichen, gefiltert auf den Account des verknüpften
 * Deals. Auswahl wird in `projects.customer_contacts` (JSON) persistiert.
 */
export default function ContactPicker({ projectId, accountId, contacts, onChange }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const queryReady = !!accountId && debouncedQuery.trim().length >= 3;

  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['zoho_contact_search', accountId, debouncedQuery],
    enabled: queryReady,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await zohoClient.searchContactsByAccount(accountId!, debouncedQuery);
      const list: any[] = res?.data || [];
      return list;
    },
  });

  const existingIds = useMemo(
    () => new Set(contacts.map((c) => c.zoho_contact_id).filter(Boolean)),
    [contacts],
  );

  const persist = async (next: ContactEntry[]) => {
    const { error } = await supabase
      .from('projects')
      .update({ customer_contacts: next as any })
      .eq('id', projectId);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    onChange();
  };

  const addContact = async (c: any) => {
    const name = `${c.First_Name || ''} ${c.Last_Name || ''}`.trim() || c.Full_Name || 'Kontakt';
    const entry: ContactEntry = {
      zoho_contact_id: c.id,
      name,
      email: c.Email || undefined,
      phone: c.Phone || c.Mobile || undefined,
    };
    if (existingIds.has(entry.zoho_contact_id)) {
      toast.message('Kontakt bereits in der Liste.');
      return;
    }
    await persist([...contacts, entry]);
    setOpen(false);
    setQuery('');
  };

  const removeContact = async (idx: number) => {
    const next = contacts.filter((_, i) => i !== idx);
    await persist(next);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Ansprechpartner
          {contacts.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({contacts.length})
            </span>
          )}
        </CardTitle>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" disabled={!accountId}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Hinzufügen
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-2 border-b">
              <Input
                autoFocus
                placeholder="Kontakt suchen (min. 3 Zeichen)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {!accountId && (
                <p className="p-3 text-xs text-muted-foreground">
                  Kein Zoho-Account verknüpft — Suche nicht möglich.
                </p>
              )}
              {accountId && debouncedQuery.trim().length < 3 && (
                <p className="p-3 text-xs text-muted-foreground">
                  Mindestens 3 Buchstaben eingeben.
                </p>
              )}
              {queryReady && isFetching && (
                <div className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Suche läuft…
                </div>
              )}
              {queryReady && !isFetching && (searchResults?.length ?? 0) === 0 && (
                <p className="p-3 text-xs text-muted-foreground">
                  Keine Treffer für „{debouncedQuery}"
                </p>
              )}
              {queryReady &&
                !isFetching &&
                (searchResults || []).map((c: any) => {
                  const name =
                    `${c.First_Name || ''} ${c.Last_Name || ''}`.trim() ||
                    c.Full_Name ||
                    'Kontakt';
                  const already = existingIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => addContact(c)}
                      disabled={already}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-accent/50 border-b last:border-b-0',
                        already && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      <div className="font-medium">{name}</div>
                      {(c.Email || c.Phone) && (
                        <div className="text-xs text-muted-foreground">
                          {[c.Email, c.Phone].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {already && (
                        <div className="text-xs text-muted-foreground italic">
                          bereits in Liste
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </PopoverContent>
        </Popover>
      </CardHeader>

      <CardContent className="pt-0">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch kein Ansprechpartner gepflegt. Suche oben nach einem Kontakt der Firma.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c, idx) => (
              <div
                key={`${c.zoho_contact_id || c.name}-${idx}`}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="text-sm">
                  <div className="font-medium">{c.name}</div>
                  {(c.email || c.phone) && (
                    <div className="text-xs text-muted-foreground">
                      {[c.email, c.phone].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeContact(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
