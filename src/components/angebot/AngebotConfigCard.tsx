import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { Zusatzvereinbarungen } from './ZusatzvereinbarungenCard';

interface CalcData {
  finance_type: string;
  term_months: number;
  total_monthly_rate: number;
  total_hardware_ek: number;
  service_rate: number;
  config_json: any;
}

interface Props {
  projectId: string;
  projectName: string;
  calcData: CalcData | null;
  zusatz: Zusatzvereinbarungen;
}

const financeLabels: Record<string, string> = {
  leasing: 'Leasing (Bank)',
  eigenmiete: 'Eigenmiete (SIRIUS)',
  kauf_wartung: 'Kauf + Wartungsvertrag',
  allin: 'All-In-Vertrag',
};

const fmt = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AngebotConfigCard({ projectId, projectName, calcData, zusatz }: Props) {
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();

  const deviceCount = calcData?.config_json?.deviceGroups?.reduce((sum: number, g: any) => sum + (g.mainQuantity || 0), 0) || 0;
  const folgeseitenSw = calcData?.config_json?.calculated?.folgeseitenpreis_sw || calcData?.config_json?.folgeseitenpreis_sw || 0;
  const folgeseitenFarbe = calcData?.config_json?.calculated?.folgeseitenpreis_farbe || calcData?.config_json?.folgeseitenpreis_farbe || 0;
  const swVolume = calcData?.config_json?.calculated?.totalSwVolume || 0;
  const colorVolume = calcData?.config_json?.calculated?.totalColorVolume || 0;

  const handleGenerate = async () => {
    if (!calcData) {
      toast.error('Bitte zuerst eine Kalkulation erstellen.');
      return;
    }
    setGenerating(true);
    try {
      // Dynamic import to avoid loading heavy PDF lib on page load
      const { generateAngebotPdf } = await import('@/lib/angebotPdfGenerator');
      const blob = await generateAngebotPdf({
        projectName,
        projectId,
        calcData,
        zusatz,
      });

      const fileName = `Angebot_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Upload to storage
      const filePath = `${projectId}/angebote/${Date.now()}_${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('project-documents')
        .upload(filePath, blob);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('project-documents')
        .getPublicUrl(filePath);

      // Create document record
      await supabase.from('documents').insert({
        project_id: projectId,
        document_type: 'angebot',
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: blob.size,
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      toast.success('Angebot wurde generiert und gespeichert.');
    } catch (err: any) {
      toast.error('Fehler beim Generieren: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📄 Angebot erstellen</CardTitle>
      </CardHeader>
      <CardContent>
        {!calcData ? (
          <p className="text-sm text-muted-foreground">Bitte zuerst eine Kalkulation im Kalkulations-Modul anlegen.</p>
        ) : (
          <div className="space-y-4">
            {/* Read-only preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Vertragsart</p>
                <p className="font-medium text-sm">{financeLabels[calcData.finance_type] || calcData.finance_type}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Laufzeit</p>
                <p className="font-medium text-sm">{calcData.term_months} Monate</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Geräteanzahl</p>
                <p className="font-medium text-sm">{deviceCount} Geräte</p>
              </div>
            </div>

            {/* Prominent monthly rate */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Monatliche Rate</p>
              <p className="text-2xl font-heading font-bold text-primary">{fmt(calcData.total_monthly_rate || 0)} €</p>
            </div>

            {/* Volume info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">S/W-Volumen: </span>
                <span className="font-medium">{swVolume.toLocaleString('de-DE')} Seiten/Monat</span>
              </div>
              <div>
                <span className="text-muted-foreground">Farb-Volumen: </span>
                <span className="font-medium">{colorVolume.toLocaleString('de-DE')} Seiten/Monat</span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis S/W: </span>
                <span className="font-medium">{folgeseitenSw.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €</span>
              </div>
              <div>
                <span className="text-muted-foreground">Folgeseitenpreis Farbe: </span>
                <span className="font-medium">{folgeseitenFarbe.toLocaleString('de-DE', { minimumFractionDigits: 4 })} €</span>
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Angebot als PDF generieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
