import { createBrowserBetterCommerceClient } from '@better-commerce/sdk/browser';

export const adminApiClient = createBrowserBetterCommerceClient();

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
