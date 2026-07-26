import { applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiResponse,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OPENAPI_CSRF_SCHEME, OPENAPI_SESSION_SCHEME } from './api-contract';
import { ProblemDetailsDto } from './problem-details.dto';

export const ApiSessionAuthenticated = () =>
  applyDecorators(
    ApiCookieAuth(OPENAPI_SESSION_SCHEME),
    ApiUnauthorizedResponse({
      description: 'A valid server-side session is required.',
      type: ProblemDetailsDto,
    }),
  );

export const ApiCsrfProtected = () =>
  applyDecorators(
    ApiSecurity(OPENAPI_CSRF_SCHEME),
    ApiForbiddenResponse({
      description: 'The session-bound CSRF token is missing or invalid.',
      type: ProblemDetailsDto,
    }),
  );

export const ApiProblemResponse = (status: number, description: string) =>
  ApiResponse({
    status,
    description,
    type: ProblemDetailsDto,
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
      },
    },
  });
