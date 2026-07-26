import { use } from 'react';
import { AdminSessionContext } from './admin-session-context';

export function useAdminSession() {
  const profile = use(AdminSessionContext);

  if (!profile) {
    throw new Error(
      'useAdminSession must be used inside an authenticated Admin session.',
    );
  }

  return profile;
}
