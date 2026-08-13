import { StructuredLoggerService } from './structured-logger.service';

describe('StructuredLoggerService', () => {
  const requestContext = { getRequestId: () => 'request-123' };

  afterEach(() => jest.restoreAllMocks());

  it('uses coloured, level-labelled records during local development', () => {
    const output = jest.spyOn(process.stdout, 'write').mockImplementation();
    const logger = new StructuredLoggerService(
      requestContext as never,
      { getOrThrow: () => 'development' } as never,
    );

    logger.event('warn', 'inventory is low', { variantId: 'variant-123' });

    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('\u001B[33mWARN'),
    );
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('inventory is low'),
    );
  });

  it('keeps production records as machine-readable JSON', () => {
    const output = jest.spyOn(process.stdout, 'write').mockImplementation();
    const logger = new StructuredLoggerService(
      requestContext as never,
      { getOrThrow: () => 'production' } as never,
    );

    logger.event('info', 'service_started', { port: 3000 });

    const line = output.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toEqual(
      expect.objectContaining({
        data: { port: 3000 },
        level: 'info',
        message: 'service_started',
        requestId: 'request-123',
      }),
    );
    expect(line).not.toContain('\u001B[');
  });
});
