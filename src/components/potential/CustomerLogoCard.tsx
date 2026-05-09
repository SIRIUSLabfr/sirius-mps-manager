import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  /** data:URI oder externe URL — kommt aus projects.quote_config.customer_logo_data_uri */
  logoUrl: string | null | undefined;
}

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB — als data:URI in der DB-JSON-Spalte

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CustomerLogoCard({ projectId, logoUrl }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  /** Speichert das data:URI als Sub-Feld in projects.quote_config — keine
   *  Migration noetig, weil quote_config bereits flex JSON ist. */
  const persistLogo = async (dataUri: string | null) => {
    const { data: fresh } = await supabase
      .from('projects')
      .select('quote_config')
      .eq('id', projectId)
      .maybeSingle();
    const existing = (fresh?.quote_config as Record<string, any>) || {};
    const next = { ...existing, customer_logo_data_uri: dataUri };
    const { error } = await supabase
      .from('projects')
      .update({ quote_config: next } as any)
      .eq('id', projectId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte eine Bilddatei auswählen (PNG, JPG, SVG, …).');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Datei zu groß. Maximal 1 MB.');
      return;
    }
    setBusy(true);
    try {
      const dataUri = await fileToDataUri(file);
      await persistLogo(dataUri);
      toast.success('Kunden-Logo gespeichert.');
    } catch (err: any) {
      toast.error('Fehler: ' + (err?.message || err));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!logoUrl) return;
    if (!confirm('Kunden-Logo wirklich entfernen?')) return;
    setBusy(true);
    try {
      await persistLogo(null);
      toast.success('Kunden-Logo entfernt.');
    } catch (err: any) {
      toast.error('Fehler: ' + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          Kunden-Logo
        </CardTitle>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {logoUrl ? 'Ersetzen' : 'Hochladen'}
          </Button>
          {logoUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {logoUrl ? (
          <div className="rounded-md border bg-muted/20 p-4 flex items-center justify-center">
            <img
              src={logoUrl}
              alt="Kunden-Logo"
              className="max-h-24 object-contain"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch kein Logo hochgeladen. Erscheint im PDF-Angebot neben dem Empfänger-Block.
            (PNG/JPG/SVG, max. 1 MB)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
