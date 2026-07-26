import { createBetterCommerceClient } from '@better-commerce/sdk';

export const adminApiClient = createBetterCommerceClient();

export {
  AdminApiError,
  executeApiRequest,
  executeEmptyApiRequest,
  isAdminApiError,
} from './request';
export {
  publishSessionLoss,
  subscribeToSessionLoss,
  type SessionLossListener,
  type SessionLossReason,
} from './session-lifecycle';
