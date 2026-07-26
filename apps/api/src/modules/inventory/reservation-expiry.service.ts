import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApplicationConfiguration } from '../../platform/config';
import { InventoryService } from './persistence/inventory.service';

@Injectable()
export class ReservationExpiryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ReservationExpiryService.name);
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    config: ConfigService<ApplicationConfiguration, true>,
    private readonly inventory: InventoryService,
  ) {
    const commerce =
      config.getOrThrow<ApplicationConfiguration['commerce']>('commerce');
    this.intervalMs = commerce.reservationSweepIntervalSeconds * 1_000;
    this.batchSize = commerce.reservationSweepBatchSize;
  }

  onApplicationBootstrap(): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      let total = 0;
      while (true) {
        const count = await this.inventory.expireReservationBatch(
          this.batchSize,
        );
        total += count;
        if (count < this.batchSize) break;
      }
      if (total > 0)
        this.logger.log(`Expired ${total} inventory reservation(s)`);
      return total;
    } catch (error) {
      this.logger.error(
        'Inventory reservation expiry sweep failed',
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
