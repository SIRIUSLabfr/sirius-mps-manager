import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useZoho } from '@/hooks/useZoho';
import { toast } from 'sonner';
import { Send, StickyNote, Loader2 } from 'lucide-react';
import type { ConceptConfig } from '@/hooks/useConceptData';
import type { Tables } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/constants';

interface Props {
  config: ConceptConfig;
  project: Tables<'projects'>;
  devices: Tables<'devices'>[];
  calculation: Tables<'calculations'> | null;
}

export default function ZohoConceptActions({ config, project, devices, calculation }: Props) {
  const { dealId, ZOHO, isReady } = useZoho();
  const [pushing, setPushing] = useState(false);
  const [noting, setNoting] = useState(false);

  const sollDevices = devices.filter(d => d.soll_model);
  const customerName = config.overrides.customer_name || project.customer_name;

  if (!isReady || !dealId || !ZOHO?.CRM) return null;

  const handlePushToZoho = async () => {
    if (!calculation) {
      toast.error('Keine Kalkulation vorhanden');
      return;
    }
    setPushing(true);
    try {
      const updateData = {
        id: dealId,
        MPS_Monthly_Rate: calculation.total_monthly_rate || 0,
        MPS_Device_Count: sollDevices.length,
        MPS_Term_Months: calculation.term_months || 60,
        MPS_Finance_Type: calculation.finance_type === 'leasing' ? 'Leasing' : 'Miete',
        MPS_Config_JSON: JSON.stringify(calculation.config_json),
      };

      await ZOHO.CRM.API.updateRecord({
        Entity: 'Deals',
        APIData: updateData,
        Trigger: ['workflow'],
      });

      toast.success('Daten erfolgreich an Zoho übergeben');
    } catch (err: any) {
      console.error('Zoho push error:', err);
      toast.error('Fehler bei der Zoho-Übertragung: ' + (err?.message || 'Unbekannt'));
    } finally {
      setPushing(false);
    }
  };

  const handleAttachNote = async () => {
    setNoting(true);
    try {
      const blocks: string[] = [];
      blocks.push(`MPS Konzept – ${customerName}`);
      blocks.push(`Projekt: ${config.overrides.project_number || project.project_number || '–'}`);
      blocks.push(`Datum: ${config.overrides.date || new Date().toISOString().slice(0, 10)}`);
      blocks.push('');

      if (config.blocks.ist_analyse) {
        const istCount = devices.filter(d => d.ist_model).length;
        blocks.push(`IST-Bestand: ${istCount} Geräte`);
      }
      if (config.blocks.soll_konzept) {
        blocks.push(`SOLL-Konzept: ${sollDevices.length} Geräte`);
      }
      if (config.blocks.finanzierung && calculation) {
        blocks.push(`Finanzierung: ${calculation.finance_type === 'leasing' ? 'Leasing' : 'Miete'}, ${calculation.term_months || 60} Monate`);
        blocks.push(`Monatliche Rate: ${formatCurrency(calculation.total_monthly_rate)}`);
      }
      if (config.texts.einleitung) {
        blocks.push('');
        blocks.push(config.texts.einleitung);
      }
      if (config.texts.abschluss) {
        blocks.push('');
        blocks.push(config.texts.abschluss);
      }

      await ZOHO.CRM.API.addNotes({
        Entity: 'Deals',
        RecordID: dealId,
        Title: `MPS Konzept – ${customerName}`,
        Note_Content: blocks.join('\n'),
      });

      toast.success('Konzept als Notiz an Zoho Deal angehängt');
    } catch (err: any) {
      console.error('Zoho note error:', err);
      toast.error('Fehler beim Anhängen: ' + (err?.message || 'Unbekannt'));
    } finally {
      setNoting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={handlePushToZoho} disabled={pushing || !calculation}>
        {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Daten an Zoho übergeben
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleAttachNote} disabled={noting}>
        {noting ? <Loader2 className="h-4 w-4 animate-spin" /> : <StickyNote className="h-4 w-4" />}
        Konzept als Notiz anhängen
      </Button>
    </div>
  );
}
