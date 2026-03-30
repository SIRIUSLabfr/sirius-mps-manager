import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZoho } from '@/hooks/useZoho';
import { useActiveProject } from '@/hooks/useActiveProject';
import { supabase } from '@/integrations/supabase/client';
import NewProjectDialog from '@/components/projects/NewProjectDialog';

/**
 * Handles Zoho Deal-ID entry logic:
 * - Deal-ID matched → navigate to project
 * - Deal-ID not matched → show new project dialog
 * - No Deal-ID → do nothing (Ebene 1 overview)
 */
export default function ZohoEntryRouter() {
  const { dealId, isReady, isZohoAvailable } = useZoho();
  const { setActiveProjectId } = useActiveProject();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [zohoPreFill, setZohoPreFill] = useState<{ customer_name?: string; contact_name?: string; deal_id?: string }>({});
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!isReady || handled) return;
    if (!dealId) {
      setHandled(true);
      return;
    }

    // Look up project by zoho_deal_id
    const lookupProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_type')
        .eq('zoho_deal_id', dealId)
        .maybeSingle();

      if (data) {
        // Project found → navigate directly
        setActiveProjectId(data.id);
        navigate(`/projekt/${data.id}`, { replace: true });
      } else {
        // No project → pre-fill from Zoho (only if SDK available in iframe)
        let preFill: any = { deal_id: dealId };
        if (isZohoAvailable()) {
          try {
            const ZOHO = (window as any).ZOHO;
            const resp = await ZOHO.CRM.API.getRecord({ Entity: 'Deals', RecordID: dealId });
            const deal = resp.data?.[0];
            if (deal) {
              preFill.customer_name = deal.Account_Name?.name || deal.Deal_Name || '';
              preFill.contact_name = deal.Contact_Name?.name || '';
            }
          } catch { /* ignore */ }
        }
        setZohoPreFill(preFill);
        setDialogOpen(true);
      }
      setHandled(true);
    };

    lookupProject();
  }, [isReady, dealId, handled, isZohoAvailable, navigate, setActiveProjectId]);

  return (
    <NewProjectDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      zohoPreFill={zohoPreFill}
    />
  );
}
