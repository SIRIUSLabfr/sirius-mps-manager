import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Undo2, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useDocuments,
  useDeletedDocuments,
  useSoftDeleteDocument,
  useRestoreDocument,
  usePermanentDeleteDocument,
} from '@/hooks/useAngebotData';

const typeLabels: Record<string, string> = {
  angebot: 'Angebot',
  auftrag_unterschrieben: 'Auftrag (unterschrieben)',
  konzept: 'Konzept',
  sonstiges: 'Sonstiges',
};

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysUntilDeletion(deletedAt: string): number {
  const deleted = new Date(deletedAt);
  const autoDelete = new Date(deleted.getTime() + 7 * 24 * 60 * 60 * 1000);
  const remaining = Math.ceil((autoDelete.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
}

interface Props {
  projectId: string;
}

export default function DocumentsList({ projectId }: Props) {
  const { data: docs = [] } = useDocuments(projectId);
  const { data: trashDocs = [] } = useDeletedDocuments(projectId);
  const softDelete = useSoftDeleteDocument();
  const restore = useRestoreDocument();
  const permanentDelete = usePermanentDeleteDocument();
  const [showTrash, setShowTrash] = useState(false);

  // Auto-delete expired trash items (>7 days)
  const activeTrash = trashDocs.filter((doc: any) => {
    const days = daysUntilDeletion(doc.deleted_at);
    if (days <= 0) {
      permanentDelete.mutate(doc.id);
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📂 Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Dokumente vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
                  <span className="text-lg">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[doc.document_type] || doc.document_type} · {formatSize(doc.file_size)} · {new Date(doc.created_at!).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  {doc.zoho_attachment_id && (
                    <Badge variant="outline" className="text-[10px] shrink-0">✅ Zoho</Badge>
                  )}
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 shrink-0">
                    <Download className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => softDelete.mutate(doc.id)}
                    title="In Papierkorb verschieben"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trash section */}
      {activeTrash.length > 0 && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTrash(!showTrash)}>
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Trash className="h-4 w-4" />
              Papierkorb ({activeTrash.length})
              {showTrash ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CardTitle>
          </CardHeader>
          {showTrash && (
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">Dokumente werden nach 7 Tagen automatisch gelöscht.</p>
              <div className="space-y-2">
                {activeTrash.map((doc: any) => {
                  const days = daysUntilDeletion(doc.deleted_at);
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/20 opacity-70">
                      <span className="text-lg">🗑️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate line-through">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Wird in {days} {days === 1 ? 'Tag' : 'Tagen'} gelöscht
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => restore.mutate(doc.id)}
                        title="Wiederherstellen"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => permanentDelete.mutate(doc.id)}
                        title="Endgültig löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
