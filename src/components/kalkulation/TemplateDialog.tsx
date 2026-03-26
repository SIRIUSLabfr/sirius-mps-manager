import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookmarkPlus, Download, Trash2, Loader2 } from 'lucide-react';

interface TemplateConfig {
  finance_type: string;
  term_months: number;
  leasing_factor: number;
  margin_total: number;
}

interface Props {
  mode: 'save' | 'load';
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentConfig?: TemplateConfig;
  onLoad?: (cfg: TemplateConfig) => void;
}

export default function TemplateDialog({ mode, open, onOpenChange, currentConfig, onLoad }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['calculation_templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('calculation_templates')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!name.trim() || !currentConfig) return;
    setSaving(true);
    const { error } = await supabase.from('calculation_templates').insert({
      name: name.trim(),
      config: {
        finance_type: currentConfig.finance_type,
        term_months: currentConfig.term_months,
        leasing_factor: currentConfig.leasing_factor,
        margin_total: currentConfig.margin_total,
      } as any,
    });
    setSaving(false);
    if (error) { toast.error('Fehler beim Speichern'); return; }
    toast.success('Vorlage gespeichert');
    queryClient.invalidateQueries({ queryKey: ['calculation_templates'] });
    setName('');
    onOpenChange(false);
  };

  const handleLoad = (tpl: any) => {
    const cfg = tpl.config as any;
    onLoad?.({
      finance_type: cfg.finance_type || 'leasing',
      term_months: cfg.term_months || 60,
      leasing_factor: cfg.leasing_factor || 0.0186,
      margin_total: cfg.margin_total || 0,
    });
    toast.success(`Vorlage "${tpl.name}" geladen`);
    onOpenChange(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('calculation_templates').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['calculation_templates'] });
    toast.success('Vorlage gelöscht');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {mode === 'save' ? <><BookmarkPlus className="h-5 w-5" /> Als Vorlage speichern</> : <><Download className="h-5 w-5" /> Vorlage laden</>}
          </DialogTitle>
        </DialogHeader>

        {mode === 'save' ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Vorlagenname</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Standard 60 Monate Leasing"
                className="h-9 text-sm"
              />
            </div>
            <DialogFooter>
              <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                Speichern
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Vorlagen vorhanden</p>
            )}
            {templates.map((tpl: any) => {
              const cfg = tpl.config as any;
              return (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/50 cursor-pointer group"
                  onClick={() => handleLoad(tpl)}
                >
                  <div>
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cfg.finance_type === 'leasing' ? 'Leasing' : 'Miete'} · {cfg.term_months} Mon.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={e => { e.stopPropagation(); handleDelete(tpl.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
