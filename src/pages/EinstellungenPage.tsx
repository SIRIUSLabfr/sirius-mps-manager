import { useUsers } from '@/hooks/useProjectData';
import { usePermissions, DEPARTMENTS, type Department } from '@/hooks/usePermissions';
import { useZoho } from '@/hooks/useZoho';
import { supabase } from '@/integrations/supabase/client';
import { zohoClient } from '@/lib/zohoClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Settings, Shield, RefreshCw, Cloud } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function EinstellungenPage() {
  const { data: users, isLoading } = useUsers();
  const { canManagePermissions, currentUser } = usePermissions();
  const { isZohoConnected, connectZoho } = useZoho();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const updateUser = async (userId: string, field: string, value: string) => {
    const { error } = await supabase.from('users').update({ [field]: value }).eq('id', userId);
    if (error) toast.error('Speicherfehler: ' + error.message);
    else {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  };

  const syncZohoUsers = async () => {
    const ADMIN_EMAIL = 'f.schueler@sirius-gmbh.de';
    const mapZohoRoleToAppRole = (zohoUser: any): 'admin' | 'project_lead' | 'technician' | 'viewer' => {
      const email = String(zohoUser?.email || '').toLowerCase();
      const source = [zohoUser?.role?.name, zohoUser?.profile?.name, zohoUser?.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (email === ADMIN_EMAIL || source.includes('admin')) return 'admin';
      if (source.includes('lead') || source.includes('leiter') || source.includes('manager') || source.includes('owner')) {
        return 'project_lead';
      }
      if (source.includes('tech') || source.includes('techn') || source.includes('service') || source.includes('support') || source.includes('ops')) {
        return 'technician';
      }
      return 'viewer';
    };

    setSyncing(true);
    try {
      const zohoUsers = await zohoClient.getAllUsers();
      if (!zohoUsers?.length) {
        toast.error('Keine Benutzer von Zoho erhalten');
        return;
      }

      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const zu of zohoUsers) {
        if (!zu.email) continue;

        const email = zu.email.toLowerCase();
        const fullName = zu.full_name || `${zu.first_name || ''} ${zu.last_name || ''}`.trim() || email;
        const role = mapZohoRoleToAppRole(zu);
        const isAdminUser = email === ADMIN_EMAIL;

        const { data: existing, error: existingError } = await supabase
          .from('users')
          .select('id, zoho_user_id, department')
          .eq('email', email)
          .maybeSingle();

        if (existingError) {
          failed++;
          console.error('Lookup error for', email, existingError);
          continue;
        }

        if (existing) {
          const updateData: {
            full_name: string;
            zoho_user_id: string;
            role: 'admin' | 'project_lead' | 'technician' | 'viewer';
            department?: Department;
          } = {
            full_name: fullName,
            zoho_user_id: zu.id,
            role,
          };

          if (isAdminUser) {
            updateData.department = 'admin';
          }

          const { error } = await supabase.from('users').update(updateData).eq('id', existing.id);
          if (error) {
            failed++;
            console.error('Update error for', email, error);
          } else {
            updated++;
          }
        } else {
          const insertData: {
            email: string;
            full_name: string;
            zoho_user_id: string;
            role: 'admin' | 'project_lead' | 'technician' | 'viewer';
            department?: Department;
          } = {
            email,
            full_name: fullName,
            zoho_user_id: zu.id,
            role,
          };

          if (isAdminUser) {
            insertData.department = 'admin';
          }

          const { error } = await supabase.from('users').insert(insertData);
          if (error) {
            failed++;
            console.error('Insert error for', email, error);
          } else {
            created++;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (failed > 0) {
        toast.error(`Zoho-Sync unvollständig: ${failed} Fehler, ${created} neu, ${updated} aktualisiert`);
      } else {
        toast.success(`Zoho-Sync abgeschlossen: ${created} neu, ${updated} aktualisiert`);
      }
    } catch (e: any) {
      toast.error('Sync-Fehler: ' + (e.message || 'Unbekannt'));
    } finally {
      setSyncing(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Einstellungen</h1>
        </div>
        <div className="flex items-center gap-2">
          {isZohoConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={syncZohoUsers}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronisiere…' : 'Aus Zoho laden'}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={connectZoho} className="gap-2">
              <Cloud className="h-4 w-4" />
              Mit Zoho verbinden
            </Button>
          )}
        </div>
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
              <p className="text-sm text-muted-foreground">
                Noch keine Benutzer.
                {isZohoConnected
                  ? ' Klicke oben auf "Aus Zoho laden" um die Benutzer zu synchronisieren.'
                  : ' Verbinde dich mit Zoho um Benutzer zu laden.'}
              </p>
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
