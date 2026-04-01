import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Props {
  projectId: string;
  orderConfirmedAt: string | null;
  orderConfirmedBy: string | null;
  signedDocumentUrl: string | null;
  signedDocZohoId: string | null;
}

export default function AuftragErteiltCard({ projectId, orderConfirmedAt, orderConfirmedBy, signedDocumentUrl, signedDocZohoId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const isConfirmed = !!orderConfirmedAt;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      // Upload to storage
      const filePath = `${projectId}/signed/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('project-documents')
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('project-documents')
        .getPublicUrl(filePath);

      // Create document entry
      const { data: doc, error: docErr } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          document_type: 'auftrag_unterschrieben',
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          notes,
        })
        .select()
        .single();
      if (docErr) throw docErr;

      // Update project
      const { error: projErr } = await supabase
        .from('projects')
        .update({
          order_confirmed_at: new Date().toISOString(),
          order_confirmed_by: 'Aktueller Benutzer',
          signed_document_id: doc.id,
          status: 'preparation',
        })
        .eq('id', projectId);
      if (projErr) throw projErr;

      // Create notifications for team
      const { data: users } = await supabase.from('users').select('id');
      if (users && users.length > 0) {
        const notifications = users.map(u => ({
          project_id: projectId,
          user_id: u.id,
          type: 'auftrag_erteilt',
          title: '✅ Neuer Auftrag bestätigt',
          message: `Ein neuer Auftrag wurde bestätigt und ist bereit zur Abwicklung.`,
          link: `/projekt/${projectId}/angebot`,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // Ensure order_processing exists
      const { data: existingOp } = await supabase
        .from('order_processing')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();
      if (!existingOp) {
        await supabase.from('order_processing').insert({ project_id: projectId, steps: {} });
      }

      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      toast.success('Auftrag bestätigt! Das Team wurde benachrichtigt.');
      setDialogOpen(false);
      setFile(null);
      setNotes('');
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className={cn(isConfirmed && 'border-l-4 border-l-green-500')}>
        <CardHeader>
          <CardTitle className="text-base">
            {isConfirmed ? '✅ Auftrag erteilt' : '📝 Auftrag erteilt'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isConfirmed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm bg-green-50 text-green-800 p-3 rounded-md">
                <CheckCircle2 className="h-4 w-4" />
                <span>Auftrag bestätigt am {new Date(orderConfirmedAt!).toLocaleDateString('de-DE')} von {orderConfirmedBy}</span>
              </div>
              {signedDocumentUrl && (
                <a href={signedDocumentUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Download className="h-3.5 w-3.5" />
                  Unterschriebenes Dokument herunterladen
                </a>
              )}
              {signedDocZohoId && (
                <Badge variant="outline" className="text-xs">📎 In Zoho Deal gespeichert</Badge>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Wenn der Kunde das Angebot unterschrieben hat, hier den Auftrag bestätigen.
              </p>
              <Button onClick={() => setDialogOpen(true)} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Auftrag erteilt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auftrag bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Unterschriebenes Dokument hochladen *</Label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById('signed-doc-input')?.click()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
                ) : (
                  <p className="text-sm text-muted-foreground">PDF, JPG oder PNG hierher ziehen oder klicken (max. 20 MB)</p>
                )}
                <input id="signed-doc-input" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div>
              <Label>Optionale Notiz</Label>
              <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Kundenreferenz, Anmerkungen..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={!file || submitting} className="bg-secondary hover:bg-secondary/90">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Auftrag bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
