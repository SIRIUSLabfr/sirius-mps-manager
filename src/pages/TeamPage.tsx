import { useState } from 'react';
import { useUsers } from '@/hooks/useProjectData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'project_lead', label: 'Projektleiter' },
  { value: 'technician', label: 'Techniker' },
  { value: 'viewer', label: 'Viewer' },
];

export default function TeamPage() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();

  const updateUser = async (userId: string, field: string, value: string) => {
    const { error } = await supabase.from('users').update({ [field]: value }).eq('id', userId);
    if (error) toast.error('Speicherfehler: ' + error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'projektleiter': return 'bg-primary/10 text-primary border-primary/20';
      case 'techniker': return 'bg-secondary/10 text-secondary border-secondary/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Team & Benutzer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Organisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !users?.length ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Noch keine Benutzer. Benutzer werden automatisch angelegt, wenn sie sich über Zoho anmelden.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_100px_140px] gap-0 px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Name</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">E-Mail</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Kürzel</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Rolle</span>
              </div>
              <div className="divide-y divide-border/50">
                {users.map(user => (
                  <div key={user.id} className="grid grid-cols-[1fr_1fr_100px_140px] gap-0 px-4 py-2 items-center hover:bg-muted/20 transition-colors">
                    <span className="text-sm font-medium">{user.full_name || '–'}</span>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                    <Input
                      defaultValue={user.short_code || ''}
                      onBlur={e => {
                        if (e.target.value !== (user.short_code || '')) {
                          updateUser(user.id, 'short_code', e.target.value);
                        }
                      }}
                      className="h-7 text-xs w-16 font-mono"
                      placeholder="–"
                    />
                    <Select value={user.role} onValueChange={v => updateUser(user.id, 'role', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
