import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FileCheck } from 'lucide-react';
import { useDocuments } from '@/hooks/useAngebotData';

const typeIcons: Record<string, string> = {
  angebot: '📄',
  auftrag_unterschrieben: '📝',
  konzept: '📄',
  sonstiges: '📎',
};

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

interface Props {
  projectId: string;
}

export default function DocumentsList({ projectId }: Props) {
  const { data: docs = [] } = useDocuments(projectId);

  return (
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
                <span className="text-lg">{typeIcons[doc.document_type] || '📎'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                {doc.zoho_attachment_id && (
                  <Badge variant="outline" className="text-[10px] shrink-0">✅ Zoho</Badge>
                )}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 shrink-0">
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
