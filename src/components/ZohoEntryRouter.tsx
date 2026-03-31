import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZoho } from '@/hooks/useZoho';
import { useActiveProject } from '@/hooks/useActiveProject';
import { supabase } from '@/integrations/supabase/client';
import NewProjectDialog from '@/components/projects/NewProjectDialog';

export default function ZohoEntryRouter() {
  const { dealId, isReady } = useZoho();
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

    const lookupProject = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_type')
        .eq('zoho_deal_id', dealId)
        .maybeSingle();

      if (data) {
        setActiveProjectId(data.id);
        navigate(`/projekt/${data.id}`, { replace: true });
      } else {
        setZohoPreFill({ deal_id: dealId });
        setDialogOpen(true);
      }
      setHandled(true);
    };

    lookupProject();
  }, [isReady, dealId, handled, navigate, setActiveProjectId]);

  return (
    <NewProjectDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      zohoPreFill={zohoPreFill}
    />
  );
}
