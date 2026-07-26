import { ReservationExpiryService } from './reservation-expiry.service';

describe('ReservationExpiryService', () => {
  it('drains bounded batches and prevents overlapping runs', async () => {
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const inventory = {
      expireReservationBatch: jest
        .fn()
        .mockImplementationOnce(async () => {
          await first;
          return 2;
        })
        .mockResolvedValueOnce(1),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({
        reservationSweepIntervalSeconds: 60,
        reservationSweepBatchSize: 2,
      }),
    };
    const service = new ReservationExpiryService(
      config as never,
      inventory as never,
    );

    const running = service.runOnce();
    await expect(service.runOnce()).resolves.toBe(0);
    releaseFirst();
    await expect(running).resolves.toBe(3);
    expect(inventory.expireReservationBatch).toHaveBeenCalledTimes(2);
  });
});
