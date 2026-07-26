import { createContext } from 'react';
import type { AdminProfile } from '../api/auth-api';

export const AdminSessionContext = createContext<AdminProfile | undefined>(
  undefined,
);
