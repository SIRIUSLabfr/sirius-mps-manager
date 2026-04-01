import { useZoho } from '@/hooks/useZoho';
import { useUsers } from '@/hooks/useProjectData';
import { useMemo } from 'react';

export type Department = 'sales' | 'operations' | 'ps_tkd' | 'ps_it' | 'admin';

export const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'sales', label: 'Sales' },
  { value: 'operations', label: 'Operations' },
  { value: 'ps_tkd', label: 'Professional Services – TKD' },
  { value: 'ps_it', label: 'Professional Services – IT' },
  { value: 'admin', label: 'Admin' },
];

export interface Permissions {
  department: Department;
  /** Can see & navigate to overview / global items */
  canSeeOverview: boolean;
  /** Can write in overview area */
  canWriteOverview: boolean;
  /** Project: can see Phase 1+2 (or Auftrag+Planung for daily) */
  canSeePhase1: boolean;
  canWritePhase1: boolean;
  canSeePhase2: boolean;
  canWritePhase2: boolean;
  /** Project: can see Phase 3 / Ausführung */
  canSeePhase3: boolean;
  canWritePhase3: boolean;
  /** Can manage user departments */
  canManagePermissions: boolean;
  /** Is admin */
  isAdmin: boolean;
}

function getPermissions(dept: Department): Permissions {
  switch (dept) {
    case 'sales':
      return {
        department: dept,
        canSeeOverview: true,
        canWriteOverview: false,
        canSeePhase1: true,
        canWritePhase1: true,
        canSeePhase2: true,
        canWritePhase2: true,
        canSeePhase3: true,
        canWritePhase3: false,
        canManagePermissions: false,
        isAdmin: false,
      };
    case 'operations':
      return {
        department: dept,
        canSeeOverview: true,
        canWriteOverview: true,
        canSeePhase1: true,
        canWritePhase1: true,
        canSeePhase2: true,
        canWritePhase2: true,
        canSeePhase3: true,
        canWritePhase3: true,
        canManagePermissions: false,
        isAdmin: false,
      };
    case 'ps_tkd':
      return {
        department: dept,
        canSeeOverview: true,
        canWriteOverview: true,
        canSeePhase1: false,
        canWritePhase1: false,
        canSeePhase2: false,
        canWritePhase2: false,
        canSeePhase3: false,
        canWritePhase3: false,
        canManagePermissions: false,
        isAdmin: false,
      };
    case 'ps_it':
      return {
        department: dept,
        canSeeOverview: true,
        canWriteOverview: false,
        canSeePhase1: false,
        canWritePhase1: false,
        canSeePhase2: false,
        canWritePhase2: false,
        canSeePhase3: true,
        canWritePhase3: true,
        canManagePermissions: false,
        isAdmin: false,
      };
    case 'admin':
      return {
        department: dept,
        canSeeOverview: true,
        canWriteOverview: true,
        canSeePhase1: true,
        canWritePhase1: true,
        canSeePhase2: true,
        canWritePhase2: true,
        canSeePhase3: true,
        canWritePhase3: true,
        canManagePermissions: true,
        isAdmin: true,
      };
  }
}

export function usePermissions(): Permissions & { currentUser: any | null } {
  const { zohoUser } = useZoho();
  const { data: users } = useUsers();

  const currentUser = useMemo(() => {
    if (!users || !zohoUser?.email) return null;
    return users.find(u => u.email.toLowerCase() === zohoUser.email.toLowerCase()) || null;
  }, [users, zohoUser]);

  const department = (currentUser?.department as Department) || 'operations';
  const perms = getPermissions(department);

  return { ...perms, currentUser };
}
