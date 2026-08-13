import { Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApplicationConfiguration } from '../config';
import { RequestContextService } from './request-context.service';
import { redactForLogging } from './log-redaction';

export type LogLevel =
  'debug' | 'error' | 'fatal' | 'info' | 'verbose' | 'warn';

export interface StructuredLogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly requestId?: string;
  readonly context?: string;
  readonly data?: unknown;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly pretty: boolean;

  constructor(
    private readonly requestContext: RequestContextService,
    config: ConfigService,
  ) {
    this.pretty =
      config.getOrThrow<ApplicationConfiguration['environment']>(
        'environment',
      ) !== 'production';
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  event(
    level: LogLevel,
    message: string,
    data?: Readonly<Record<string, unknown>>,
  ): void {
    this.emit({
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.requestContext.getRequestId(),
      data: data === undefined ? undefined : redactForLogging(data),
    });
  }

  protected emit(record: StructuredLogRecord): void {
    const line = this.pretty
      ? `${formatPrettyRecord(record)}\n`
      : `${JSON.stringify(record)}\n`;
    if (record.level === 'error' || record.level === 'fatal') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const possibleContext = optionalParams.at(-1);
    const context =
      typeof possibleContext === 'string' && optionalParams.length > 0
        ? possibleContext
        : undefined;
    const data = context ? optionalParams.slice(0, -1) : optionalParams;

    this.emit({
      timestamp: new Date().toISOString(),
      level,
      message:
        typeof message === 'string'
          ? (redactForLogging(message) as string)
          : 'Structured log event',
      requestId: this.requestContext.getRequestId(),
      context,
      data:
        typeof message !== 'string' || data.length > 0
          ? redactForLogging(
              typeof message === 'string' ? data : [message, ...data],
            )
          : undefined,
    });
  }
}

const ANSI = {
  dim: '\u001B[2m',
  reset: '\u001B[0m',
  blue: '\u001B[34m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  red: '\u001B[31m',
  magenta: '\u001B[35m',
} as const;

function formatPrettyRecord(record: StructuredLogRecord): string {
  const color = colorFor(record.level);
  const level = record.level.toUpperCase().padEnd(7);
  const parts = [
    `${ANSI.dim}${record.timestamp}${ANSI.reset}`,
    `${color}${level}${ANSI.reset}`,
    record.context ? `[${record.context}]` : undefined,
    record.message,
    record.requestId
      ? `${ANSI.dim}requestId=${record.requestId}${ANSI.reset}`
      : undefined,
    record.data === undefined
      ? undefined
      : `${ANSI.dim}${JSON.stringify(record.data)}${ANSI.reset}`,
  ];
  return parts.filter((part): part is string => part !== undefined).join(' ');
}

function colorFor(level: LogLevel): string {
  switch (level) {
    case 'debug':
    case 'verbose':
      return ANSI.blue;
    case 'info':
      return ANSI.green;
    case 'warn':
      return ANSI.yellow;
    case 'error':
      return ANSI.red;
    case 'fatal':
      return ANSI.magenta;
  }
}
