import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessageIntent,
  MessageIntentStatus,
  MessagePurpose,
} from './message-intent.entity';
import { MessageDeliveryAttempt } from './message-delivery-attempt.entity';
import {
  DeliveryAttemptStatus,
  DeterministicMessageProvider,
  type MessageProvider,
} from './provider';

export interface CreateTestMessageInput {
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

@Injectable()
export class CommunicationsService {
  private readonly provider: MessageProvider =
    new DeterministicMessageProvider();

  constructor(
    @InjectRepository(MessageIntent)
    private readonly intents: Repository<MessageIntent>,
    @InjectRepository(MessageDeliveryAttempt)
    private readonly attempts: Repository<MessageDeliveryAttempt>,
  ) {}

  async queueTestMessage(input: CreateTestMessageInput): Promise<MessageHistory> {
    const intent = await this.intents.save(
      this.intents.create({
        purpose: MessagePurpose.TEST,
        destination: process.env.COMMUNICATIONS_TEST_DESTINATION ?? '989120000000',
        renderedBody: input.body,
        providerKey: this.provider.key,
        status: MessageIntentStatus.QUEUED,
        lastErrorCode: null,
      }),
    );

    // The durable worker introduced in the next ticket will claim queued rows.
    // Keeping this asynchronous preserves the public queued contract today.
    setImmediate(() => void this.process(intent.id));
    return this.getHistory(intent.id);
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
          providerKey: this.provider.key,
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
}
