export enum DeliveryAttemptStatus {
  ACCEPTED = 'accepted',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
}

export interface MessageProviderRequest {
  readonly destination: string;
  readonly body: string;
  readonly purpose: string;
  readonly idempotencyKey: string;
}

export interface MessageProviderResult {
  readonly status: DeliveryAttemptStatus;
  readonly externalMessageId?: string;
  readonly outcomeCode?: string;
}

export interface MessageProvider {
  readonly key: string;
  send(request: MessageProviderRequest): Promise<MessageProviderResult>;
}

/** Deterministic adapter used by local development and the full-stack test seam. */
export class DeterministicMessageProvider implements MessageProvider {
  readonly key = 'deterministic';

  async send(request: MessageProviderRequest): Promise<MessageProviderResult> {
    return {
      status: DeliveryAttemptStatus.ACCEPTED,
      externalMessageId: `det-${request.idempotencyKey}`,
      outcomeCode: 'accepted',
    };
  }
}
