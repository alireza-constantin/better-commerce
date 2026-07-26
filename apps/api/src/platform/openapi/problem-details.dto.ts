import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemErrorDto {
  @ApiProperty({ example: 'email must be an email' })
  detail!: string;
}

/**
 * RFC 9457-style error envelope returned by the global exception filter.
 * Module-specific scalar extensions such as `code`, `currentVersion`, and
 * `retryAfterSeconds` may also be present.
 */
export class ProblemDetailsDto {
  @ApiProperty({
    example: 'urn:better-commerce:problem:bad-request',
  })
  type!: string;

  @ApiProperty({ example: 'Bad Request' })
  title!: string;

  @ApiProperty({ example: 400 })
  status!: number;

  @ApiProperty({ example: 'Request validation failed' })
  detail!: string;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;

  @ApiPropertyOptional({ type: () => [ProblemErrorDto] })
  errors?: ProblemErrorDto[];

  @ApiPropertyOptional({
    description: 'Stable module-specific machine-readable error code.',
    example: 'catalog.validation_failed',
  })
  code?: string;

  @ApiPropertyOptional({
    description: 'Retry delay returned with rate-limited responses.',
    example: 30,
    minimum: 1,
  })
  retryAfterSeconds?: number;
}
