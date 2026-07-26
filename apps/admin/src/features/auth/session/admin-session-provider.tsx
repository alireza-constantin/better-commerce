import type { ReactNode } from 'react';
import type { AdminProfile } from '../api/auth-api';
import { AdminSessionContext } from './admin-session-context';

interface AdminSessionProviderProps {
  readonly children: ReactNode;
  readonly profile: AdminProfile;
}

export function AdminSessionProvider({
  children,
  profile,
}: AdminSessionProviderProps) {
  return (
    <AdminSessionContext.Provider value={profile}>
      {children}
    </AdminSessionContext.Provider>
  );
}
