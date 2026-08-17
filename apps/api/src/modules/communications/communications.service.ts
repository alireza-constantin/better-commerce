import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageIntent,
  MessageIntentStatus,
  MessagePurpose,
} from './message-intent.entity';
import { MessageDeliveryAttempt } from './message-delivery-attempt.entity';
import { MessageProviderRoute } from './message-provider-route.entity';
import {
  DeliveryAttemptStatus,
  DeterministicMessageProvider,
  type MessageProvider,
} from './provider';

export interface CreateTestMessageInput {
  readonly body: string;
}

export interface QueueMessageInput {
  readonly purpose: MessagePurpose;
  readonly destination: string;
  readonly body: string;
}

export interface MessageHistory {
  readonly id: string;
  readonly purpose: MessagePurpose;
  readonly status: MessageIntentStatus;
  readonly destination: '[masked]';
  readonly providerKey: string;
  readonly createdAt: Date;
  readonly attempts: readonly {
    readonly id: string;
    readonly attemptNumber: number;
    readonly providerKey: string;
    readonly status: DeliveryAttemptStatus;
    readonly externalMessageId: string | null;
    readonly outcomeCode: string | null;
    readonly createdAt: Date;
  }[];
}

export interface ProviderRouteView {
  readonly purpose: MessagePurpose;
  readonly providerKey: string;
  readonly enabled: boolean;
}

@Injectable()
export class CommunicationsService {
  private readonly provider: MessageProvider =
    new DeterministicMessageProvider();

  constructor(
    @InjectRepository(MessageIntent)
    private readonly intents: Repository<MessageIntent>,
    @InjectRepository(MessageDeliveryAttempt)
    private readonly attempts: Repository<MessageDeliveryAttempt>,
    @InjectRepository(MessageProviderRoute)
    private readonly routes: Repository<MessageProviderRoute>,
  ) {}

  async queueTestMessage(input: CreateTestMessageInput): Promise<MessageHistory> {
    return this.queueMessage({
      purpose: MessagePurpose.TEST,
      destination: process.env.COMMUNICATIONS_TEST_DESTINATION ?? '989120000000',
      body: input.body,
    });
  }

  async queueAuthenticationOtp(
    destination: string,
    code: string,
  ): Promise<MessageHistory> {
    return this.queueMessage({
      purpose: MessagePurpose.AUTHENTICATION,
      destination,
      body: `Your verification code is ${code}`,
    });
  }

  private async queueMessage(input: QueueMessageInput): Promise<MessageHistory> {
    const providerKey = await this.ensureRoute(input.purpose);
    const intent = await this.intents.save(
      this.intents.create({
        purpose: input.purpose,
        destination: input.destination,
        renderedBody: input.body,
        providerKey,
        status: MessageIntentStatus.QUEUED,
        lastErrorCode: null,
      }),
    );

    // The durable worker introduced in the next ticket will claim queued rows.
    // Keeping this asynchronous preserves the public queued contract today.
    setImmediate(() => void this.process(intent.id));
    return this.getHistory(intent.id);
  }

  async listRoutes(): Promise<readonly ProviderRouteView[]> {
    const routes = await this.routes.find({ order: { purpose: 'ASC' } });
    return routes.map((route) => ({
      purpose: route.purpose,
      providerKey: route.providerKey,
      enabled: route.enabled,
    }));
  }

  async configureRoute(
    purpose: MessagePurpose,
    providerKey: string,
    enabled: boolean,
  ): Promise<ProviderRouteView> {
    if (providerKey !== this.provider.key) {
      throw new Error('Provider is not configured');
    }
    const existing = await this.routes.findOneBy({ purpose });
    const route = existing ?? this.routes.create({ purpose });
    route.providerKey = providerKey;
    route.enabled = enabled;
    const saved = await this.routes.save(route);
    return {
      purpose: saved.purpose,
      providerKey: saved.providerKey,
      enabled: saved.enabled,
    };
  }

  async getHistory(id: string): Promise<MessageHistory> {
    const intent = await this.intents.findOneBy({ id });
    if (!intent) throw new NotFoundException('Message was not found');
    const attempts = await this.attempts.find({
      where: { intentId: id },
      order: { attemptNumber: 'ASC' },
    });
    return {
      id: intent.id,
      purpose: intent.purpose,
      status: intent.status,
      destination: '[masked]',
      providerKey: intent.providerKey,
      createdAt: intent.createdAt,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        providerKey: attempt.providerKey,
        status: attempt.status,
        externalMessageId: attempt.externalMessageId,
        outcomeCode: attempt.outcomeCode,
        createdAt: attempt.createdAt,
      })),
    };
  }

  private async process(intentId: string): Promise<void> {
    const intent = await this.intents.findOneBy({ id: intentId });
    if (!intent || intent.status !== MessageIntentStatus.QUEUED) return;
    intent.status = MessageIntentStatus.PROCESSING;
    await this.intents.save(intent);

    try {
      const result = await this.provider.send({
        destination: intent.destination,
        body: intent.renderedBody,
        purpose: intent.purpose,
        idempotencyKey: intent.id,
      });
      await this.attempts.save(
        this.attempts.create({
          intentId: intent.id,
          attemptNumber: 1,
        providerKey: intent.providerKey,
          status: result.status,
          externalMessageId: result.externalMessageId ?? null,
          outcomeCode: result.outcomeCode ?? null,
        }),
      );
      intent.status =
        result.status === DeliveryAttemptStatus.ACCEPTED
          ? MessageIntentStatus.ACCEPTED
          : result.status === DeliveryAttemptStatus.DELIVERED
            ? MessageIntentStatus.DELIVERED
            : result.status === DeliveryAttemptStatus.FAILED
              ? MessageIntentStatus.FAILED
              : MessageIntentStatus.UNKNOWN;
      intent.lastErrorCode = result.outcomeCode ?? null;
    } catch {
      await this.attempts.save(
        this.attempts.create({
          intentId: intent.id,
          attemptNumber: 1,
          providerKey: this.provider.key,
          status: DeliveryAttemptStatus.UNKNOWN,
          externalMessageId: null,
          outcomeCode: 'provider_error',
        }),
      );
      intent.status = MessageIntentStatus.UNKNOWN;
      intent.lastErrorCode = 'provider_error';
    }
    await this.intents.save(intent);
  }

  private async ensureRoute(purpose: MessagePurpose): Promise<string> {
    const existing = await this.routes.findOneBy({ purpose });
    if (existing) {
      if (!existing.enabled) throw new Error('Message route is disabled');
      return existing.providerKey;
    }
    const route = await this.routes.save(
      this.routes.create({
        purpose,
        providerKey: this.provider.key,
        enabled: true,
      }),
    );
    return route.providerKey;
  }
}
