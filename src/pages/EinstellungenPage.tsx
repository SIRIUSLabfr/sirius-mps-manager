import { useUsers } from '@/hooks/useProjectData';
import { usePermissions, DEPARTMENTS, type Department } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Settings, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function EinstellungenPage() {
  const { data: users, isLoading } = useUsers();
  const { canManagePermissions, currentUser } = usePermissions();
  const queryClient = useQueryClient();

  const updateUser = async (userId: string, field: string, value: string) => {
    const { error } = await supabase.from('users').update({ [field]: value }).eq('id', userId);
    if (error) toast.error('Speicherfehler: ' + error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  };

  const deptBadgeColor = (dept: string) => {
    switch (dept) {
      case 'admin': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'operations': return 'bg-primary/10 text-primary border-primary/20';
      case 'sales': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'ps_tkd': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'ps_it': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDeptLabel = (dept: string) => DEPARTMENTS.find(d => d.value === dept)?.label || dept;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Einstellungen</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Team & Berechtigungen
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
              <div className="grid grid-cols-[1fr_1fr_80px_180px] gap-0 px-4 py-2 bg-muted/50 border-b border-border">
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Name</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">E-Mail</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground">Kürzel</span>
                <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Abteilung
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {users.map(user => {
                  const isCurrentUser = currentUser?.id === user.id;
                  const userDept = (user as any).department || 'operations';
                  return (
                    <div key={user.id} className={`grid grid-cols-[1fr_1fr_80px_180px] gap-0 px-4 py-2 items-center hover:bg-muted/20 transition-colors ${isCurrentUser ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{user.full_name || '–'}</span>
                        {isCurrentUser && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Du</Badge>}
                      </div>
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
                        disabled={!canManagePermissions}
                      />
                      {canManagePermissions ? (
                        <Select
                          value={userDept}
                          onValueChange={v => updateUser(user.id, 'department', v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(d => (
                              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${deptBadgeColor(userDept)}`}>
                          {getDeptLabel(userDept)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permission legend */}
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground mb-3">Berechtigungsübersicht</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div><Badge variant="outline" className="text-[10px] mr-2 bg-blue-500/10 text-blue-600 border-blue-500/20">Sales</Badge>Lesen überall, Schreiben Phase 1+2</div>
              <div><Badge variant="outline" className="text-[10px] mr-2 bg-primary/10 text-primary border-primary/20">Operations</Badge>Lesen & Schreiben überall</div>
              <div><Badge variant="outline" className="text-[10px] mr-2 bg-amber-500/10 text-amber-600 border-amber-500/20">PS – TKD</Badge>Nur übergreifender Bereich</div>
              <div><Badge variant="outline" className="text-[10px] mr-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">PS – IT</Badge>Ab Phase 3 / Ausführung</div>
              <div><Badge variant="outline" className="text-[10px] mr-2 bg-destructive/10 text-destructive border-destructive/20">Admin</Badge>Vollzugriff + Rechteverwaltung</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
